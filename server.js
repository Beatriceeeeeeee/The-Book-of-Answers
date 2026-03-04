const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 静态资源：把当前目录作为静态目录，方便通过 http://localhost:3000 访问页面
app.use(express.static(__dirname));

// 简单的健康检查
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// 调试日志：统一封装一个发送到调试服务的小函数
function sendDebugLog(payload) {
  // #region agent log
  fetch("http://127.0.0.1:7348/ingest/bf8deb0c-8e9a-45f2-b9e0-7ba6b208a6af", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "8bd50f"
    },
    body: JSON.stringify({
      sessionId: "8bd50f",
      runId: payload.runId || "proxy",
      hypothesisId: payload.hypothesisId || "P1",
      location: payload.location,
      message: payload.message,
      data: payload.data || {},
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
}

// 统一校验请求体
function validateBody(req, res) {
  const { apiKey, systemPrompt, userPrompt } = req.body || {};
  if (!apiKey || !systemPrompt || !userPrompt) {
    return res.status(400).json({ error: "缺少必要参数" });
  }
  return { apiKey, systemPrompt, userPrompt };
}

const ANTHROPIC_MODELS_TO_TRY = [
  "claude-3-5-sonnet-20241022",
  "claude-3-haiku-20240307"
];

app.post("/api/anthropic", async (req, res) => {
  const body = validateBody(req, res);
  if (!body.apiKey) return;

  const { apiKey, systemPrompt, userPrompt } = body;

  sendDebugLog({
    location: "server.js:/api/anthropic",
    message: "proxy anthropic request",
    data: { hasKey: !!apiKey, systemPromptLength: systemPrompt.length, userPromptLength: userPrompt.length }
  });

  try {
    let lastStatus = 0;
    let lastErrText = "";

    for (const model of ANTHROPIC_MODELS_TO_TRY) {
      const upstreamBody = {
        model,
        max_tokens: 800,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      };

      const upstreamRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(upstreamBody)
      });

      if (upstreamRes.ok) {
        const data = await upstreamRes.json();
        const reply = data?.content?.[0]?.text || "";
        return res.json({ reply });
      }

      lastStatus = upstreamRes.status;
      lastErrText = await upstreamRes.text();
      console.error("[Anthropic] upstream error:", lastStatus, lastErrText.slice(0, 500));

      // 没权限或未开通（403/404）则尝试下一个更易获得的模型
      if (lastStatus === 403 || lastStatus === 404) continue;

      // 其它错误直接返回
      return res.status(502).json({ error: "Anthropic API error", status: lastStatus, detail: lastErrText });
    }

    return res.status(502).json({
      error: "Anthropic API error",
      status: lastStatus,
      detail: lastErrText
    });
  } catch (err) {
    sendDebugLog({
      location: "server.js:/api/anthropic",
      hypothesisId: "P3",
      message: "anthropic proxy exception",
      data: { error: String(err && err.message) }
    });
    res.status(500).json({ error: "Anthropic proxy error" });
  }
});

app.post("/api/openai", async (req, res) => {
  const body = validateBody(req, res);
  if (!body.apiKey) return;

  const { apiKey, systemPrompt, userPrompt } = body;

  sendDebugLog({
    location: "server.js:/api/openai",
    message: "proxy openai request",
    data: { hasKey: !!apiKey }
  });

  try {
    const upstreamBody = {
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 800
    };

    const upstreamRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(upstreamBody)
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      console.error("[OpenAI] upstream error:", upstreamRes.status, errText.slice(0, 500));
      sendDebugLog({
        location: "server.js:/api/openai",
        hypothesisId: "P2",
        message: "openai upstream not ok",
        data: { status: upstreamRes.status }
      });
      return res.status(502).json({ error: "OpenAI API error", status: upstreamRes.status, detail: errText });
    }

    const data = await upstreamRes.json();
    let text = data?.choices?.[0]?.message?.content;
    if (Array.isArray(text)) {
      text = text.map((p) => (typeof p === "string" ? p : p.text || "")).join("");
    }
    if (typeof text !== "string") {
      text = "";
    }
    res.json({ reply: text });
  } catch (err) {
    sendDebugLog({
      location: "server.js:/api/openai",
      hypothesisId: "P3",
      message: "openai proxy exception",
      data: { error: String(err && err.message) }
    });
    res.status(500).json({ error: "OpenAI proxy error" });
  }
});

const GEMINI_MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash"
];

function buildGeminiRequestBody(systemPrompt, userPrompt) {
  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `系统提示词：${systemPrompt}\n\n请根据以下信息进行回答：\n${userPrompt}`
          }
        ]
      }
    ]
  };
}

function isQuotaExhausted(status, errText) {
  return (
    status === 429 ||
    (errText && /RESOURCE_EXHAUSTED|Quota exceeded|limit:\s*0/i.test(errText))
  );
}

app.post("/api/gemini", async (req, res) => {
  const body = validateBody(req, res);
  if (!body.apiKey) return;

  const { apiKey, systemPrompt, userPrompt } = body;
  const upstreamBody = buildGeminiRequestBody(systemPrompt, userPrompt);

  sendDebugLog({
    location: "server.js:/api/gemini",
    message: "proxy gemini request",
    data: { hasKey: !!apiKey }
  });

  try {
    let lastStatus = 0;
    let lastErrText = "";

    for (const model of GEMINI_MODELS_TO_TRY) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const upstreamRes = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(upstreamBody)
      });

      if (upstreamRes.ok) {
        const data = await upstreamRes.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return res.json({ reply: text });
      }

      lastStatus = upstreamRes.status;
      lastErrText = await upstreamRes.text();
      try {
        const errJson = JSON.parse(lastErrText);
        console.error("[Gemini] upstream error:", upstreamRes.status, errJson);
      } catch {
        console.error("[Gemini] upstream error:", upstreamRes.status, lastErrText.slice(0, 300));
      }

      if (lastStatus === 404 || lastStatus === 403) continue;
      if (isQuotaExhausted(lastStatus, lastErrText)) {
        sendDebugLog({
          location: "server.js:/api/gemini",
          hypothesisId: "P2",
          message: "gemini quota exhausted",
          data: { status: lastStatus }
        });
        return res.status(502).json({
          error: "Gemini API error",
          status: lastStatus,
          detail:
            "当前 Google API Key 的免费额度已用尽或未开放该模型。可稍后重试，或到 https://ai.google.dev 查看额度/可用模型；也可改用 DeepSeek、Claude 等。"
        });
      }

      return res.status(502).json({
        error: "Gemini API error",
        status: lastStatus,
        detail: lastErrText
      });
    }

    return res.status(502).json({
      error: "Gemini API error",
      status: lastStatus,
      detail:
        lastStatus === 404
          ? "当前 Key 下没有可用的 Gemini 模型，请到 Google AI Studio 查看可用模型。"
          : lastErrText
    });
  } catch (err) {
    sendDebugLog({
      location: "server.js:/api/gemini",
      hypothesisId: "P3",
      message: "gemini proxy exception",
      data: { error: String(err && err.message) }
    });
    res.status(500).json({ error: "Gemini proxy error" });
  }
});

// DeepSeek 代理
app.post("/api/deepseek", async (req, res) => {
  const body = validateBody(req, res);
  if (!body.apiKey) return;

  const { apiKey, systemPrompt, userPrompt } = body;

  sendDebugLog({
    location: "server.js:/api/deepseek",
    message: "proxy deepseek request",
    data: { hasKey: !!apiKey }
  });

  try {
    const upstreamBody = {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 800
    };

    const upstreamRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(upstreamBody)
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      console.error("[DeepSeek] upstream error:", upstreamRes.status, errText.slice(0, 500));
      sendDebugLog({
        location: "server.js:/api/deepseek",
        hypothesisId: "P2",
        message: "deepseek upstream not ok",
        data: { status: upstreamRes.status }
      });
      return res.status(502).json({ error: "DeepSeek API error", status: upstreamRes.status, detail: errText });
    }

    const data = await upstreamRes.json();
    const text = data?.choices?.[0]?.message?.content || "";
    res.json({ reply: text });
  } catch (err) {
    sendDebugLog({
      location: "server.js:/api/deepseek",
      hypothesisId: "P3",
      message: "deepseek proxy exception",
      data: { error: String(err && err.message) }
    });
    res.status(500).json({ error: "DeepSeek proxy error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
