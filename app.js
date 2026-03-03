const ANSWER_LIBRARY = {
  // 普通组
  normal: [
    "履行你应尽的义务。",
    "谨慎处理",
    "如果你不抵触的话",
    "认真倾听你就会知道",
    "灵活变通",
    "意料之外",
    "那将仍是不可预测的",
    "相信你的直觉",
    "尽你所能去进步",
    "行动起来",
    "貌似是有把握的",
    "耐心一点",
    "不要被压力迫使着行事",
    "先去完成其他事",
    "以好奇之心去探究",
    "答案就在你身后",
    "不要被情绪左右",
    "拭目以待",
    "你会发现自己无法妥协",
    "尝试剑走偏锋",
    "发挥你的想象力",
    "一年后这件事就没那么重要了",
    "鼓起勇气",
    "数到 10，再问一次",
    "好事多磨",
    "你需要掌握主动权",
    "等待葡萄成熟时",
    "遵守规则",
    "把握机会",
    "这正是制定计划的好时候"
  ],
  // 好话 / 疗愈组
  healing: [
    "你一定会得到支持",
    "你的行为会使事物更加美好",
    "笑一笑",
    "付出会有回报的",
    "那将是一件乐事",
    "有乐观的理由",
    "带着你的善意坚持到底",
    "记得享乐",
    "让自己先休息一下",
    "欣喜地确认这一点",
    "那将是极好的",
    "享受这段经历",
    "不会失败",
    "保持开明",
    "你会发现它的价值",
    "它会带来好运的",
    "以轻松的步伐前进",
    "结局将会是正面的",
    "柳暗花明又一村",
    "莫愁前路无知己",
    "有决心就能成功",
    "全身心投入将取得好结果",
    "你有能力以任何方式改善",
    "你最终能如愿",
    "事情会朝目标发展",
    "更细心去了解，你就知道该怎么做了",
    "很快就能解决",
    "给自己一点时间",
    "无需担忧",
    "你会为自己所做的感到高兴的"
  ]
};

const STORAGE_KEYS = {
  provider: "book_of_answers_selected_provider",
  keys: {
    anthropic: "book_of_answers_anthropic_key",
    openai: "book_of_answers_openai_key",
    gemini: "book_of_answers_gemini_key",
    deepseek: "book_of_answers_deepseek_key"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const questionInput = document.getElementById("question-input");
  const charCounter = document.getElementById("char-counter");
  const healingToggle = document.getElementById("healing-toggle");
  const drawAnswerBtn = document.getElementById("draw-answer-btn");
  const answerText = document.getElementById("answer-text");
  const pagePlaceholder = document.getElementById("page-placeholder");
  const bookFrame = document.querySelector(".book-frame");

  const deepResult = document.getElementById("deep-result");
  const deepContent = document.getElementById("deep-content");
  const deepAnswerBtn = document.getElementById("deep-answer-btn");
  const clearKeysBtn = document.getElementById("clear-keys-btn");
  const modelSelectGroup = document.getElementById("model-select-group");
  const deepSection = document.getElementById("deep-section");
  const toggleDeepPanelBtn = document.getElementById("toggle-deep-panel");

  const anthropicKeyInput = document.getElementById("anthropic-key");
  const openaiKeyInput = document.getElementById("openai-key");
  const geminiKeyInput = document.getElementById("gemini-key");
  const deepseekKeyInput = document.getElementById("deepseek-key");

  let isHealingMode = false;
  let currentAnswer = "";
  let isFlipping = false;
  let selectedProvider = "anthropic";

  // 字数统计
  const updateCharCounter = () => {
    const len = (questionInput.value || "").length;
    charCounter.textContent = `${len} / 30`;
  };

  questionInput.addEventListener("input", updateCharCounter);
  updateCharCounter();

  // 疗愈状态切换
  healingToggle.addEventListener("click", () => {
    isHealingMode = !isHealingMode;
    healingToggle.classList.toggle("healing-toggle-active", isHealingMode);
  });

  // 从答案库中抽取答案
  function pickRandomAnswer() {
    const pool = isHealingMode ? ANSWER_LIBRARY.healing : [...ANSWER_LIBRARY.normal, ...ANSWER_LIBRARY.healing];
    if (!pool.length) {
      return "答案库还没有被填充，请稍后再试。";
    }
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  // 翻页动画并显示答案
  function flipAndShowAnswer(text) {
    if (isFlipping) return;
    isFlipping = true;

    // 隐藏旧内容
    answerText.classList.remove("visible");
    pagePlaceholder.style.opacity = "1";

    // 触发轻微缩放 / 光晕动画
    if (bookFrame) {
      bookFrame.style.transition =
        "transform 0.4s ease-out, box-shadow 0.4s ease-out, border-color 0.4s ease-out";
      bookFrame.style.transform = "translateY(-2px) scale(1.01)";
      bookFrame.style.boxShadow = "0 26px 90px rgba(255, 191, 174, 0.65)";
      bookFrame.style.borderColor = "rgba(255, 191, 174, 0.7)";
    }

    setTimeout(() => {
      currentAnswer = text;
      answerText.textContent = text;
      pagePlaceholder.style.opacity = "0";
      answerText.classList.add("visible");
    }, 480);

    setTimeout(() => {
      if (bookFrame) {
        bookFrame.style.transform = "";
        bookFrame.style.boxShadow = "";
        bookFrame.style.borderColor = "";
      }
      isFlipping = false;
    }, 900);
  }

  // “翻开答案之书”按钮
  drawAnswerBtn.addEventListener("click", () => {
    const question = (questionInput.value || "").trim();
    if (!question) {
      alert("先写下你此刻想问的问题吧。");
      questionInput.focus();
      return;
    }
    if (question.length > 30) {
      alert("问题不能超过 30 个字。");
      return;
    }

    const answer = pickRandomAnswer();
    flipAndShowAnswer(answer);

    deepContent.textContent = "";
    const placeholder = deepResult.querySelector(".deep-placeholder");
    if (placeholder) {
      placeholder.textContent =
        "若你想要更细致的引导，请先在上方填入你自己的 API Key，然后点击「获取深度解答」。";
    }
  });

  // 展开 / 收起深度解答配置面板
  toggleDeepPanelBtn.addEventListener("click", () => {
    const isCollapsed = deepSection.classList.contains("deep-section-collapsed");
    if (isCollapsed) {
      deepSection.classList.remove("deep-section-collapsed");
      toggleDeepPanelBtn.textContent = "收起深度解答";
      setTimeout(() => {
        deepSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } else {
      deepSection.classList.add("deep-section-collapsed");
      toggleDeepPanelBtn.textContent = "获取深度解答";
    }
  });

  // 模型提供商选择
  modelSelectGroup.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest(".pill");
    if (!btn) return;

    const model = btn.getAttribute("data-model");
    if (!model) return;

    selectedProvider = model;
    for (const child of modelSelectGroup.children) {
      child.classList.remove("pill-active");
    }
    btn.classList.add("pill-active");
    saveSelectedProvider();
  });

  // 本地存储：provider + keys
  function saveSelectedProvider() {
    try {
      localStorage.setItem(STORAGE_KEYS.provider, selectedProvider);
    } catch {
      // ignore
    }
  }

  function saveKeysToStorage() {
    try {
      if (anthropicKeyInput.value) {
        localStorage.setItem(STORAGE_KEYS.keys.anthropic, anthropicKeyInput.value);
      }
      if (openaiKeyInput.value) {
        localStorage.setItem(STORAGE_KEYS.keys.openai, openaiKeyInput.value);
      }
      if (geminiKeyInput.value) {
        localStorage.setItem(STORAGE_KEYS.keys.gemini, geminiKeyInput.value);
      }
      if (deepseekKeyInput.value) {
        localStorage.setItem(STORAGE_KEYS.keys.deepseek, deepseekKeyInput.value);
      }
    } catch {
      // ignore
    }
  }

  function loadKeysFromStorage() {
    try {
      anthropicKeyInput.value =
        localStorage.getItem(STORAGE_KEYS.keys.anthropic) || "";
      openaiKeyInput.value = localStorage.getItem(STORAGE_KEYS.keys.openai) || "";
      geminiKeyInput.value = localStorage.getItem(STORAGE_KEYS.keys.gemini) || "";
      deepseekKeyInput.value =
        localStorage.getItem(STORAGE_KEYS.keys.deepseek) || "";

      const storedProvider = localStorage.getItem(STORAGE_KEYS.provider);
      if (storedProvider) {
        selectedProvider = storedProvider;
        for (const child of modelSelectGroup.children) {
          const btn = child;
          const model = btn.getAttribute("data-model");
          if (model === storedProvider) {
            btn.classList.add("pill-active");
          } else {
            btn.classList.remove("pill-active");
          }
        }
      }
    } catch {
      // ignore
    }
  }

  loadKeysFromStorage();

  // 清除 Key
  clearKeysBtn.addEventListener("click", () => {
    const ok = confirm("确定要清除保存在本地浏览器中的所有 API Key 吗？");
    if (!ok) return;
    try {
      for (const k of Object.values(STORAGE_KEYS.keys)) {
        localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }

    anthropicKeyInput.value = "";
    openaiKeyInput.value = "";
    geminiKeyInput.value = "";
    deepseekKeyInput.value = "";

    alert("本地保存的 Key 已被清除。如果这是公用电脑，感谢你的谨慎。");
  });

  // 深度解答：统一入口
  deepAnswerBtn.addEventListener("click", async () => {
    const question = (questionInput.value || "").trim();
    if (!question) {
      alert("先写下你的问题，再获取深度解答。");
      questionInput.focus();
      return;
    }
    if (!currentAnswer) {
      alert("请先翻开答案之书，获得一个答案之后，再请求深度解答。");
      return;
    }

    let key = "";
    if (selectedProvider === "anthropic") {
      key = anthropicKeyInput.value.trim();
    } else if (selectedProvider === "openai") {
      key = openaiKeyInput.value.trim();
    } else if (selectedProvider === "gemini") {
      key = geminiKeyInput.value.trim();
    } else if (selectedProvider === "deepseek") {
      key = deepseekKeyInput.value.trim();
    }

    if (!key) {
      alert("请先在对应模型下方输入你的 API Key。");
      return;
    }

    saveKeysToStorage();

    deepAnswerBtn.disabled = true;
    deepAnswerBtn.textContent = "正在与模型对话...";
    deepContent.textContent = "";
    const placeholder = deepResult.querySelector(".deep-placeholder");
    if (placeholder) {
      placeholder.textContent = "正在生成深度解答，请稍候片刻...";
    }

    const systemPrompt =
      "你是一位温柔、理性且疗愈系的解答者，会用柔和、清晰的中文，帮助用户看见自己此刻的状态，避免命令式的语气，不做绝对的预言与保证，只是陪伴和引导。";
    const userPrompt = [
      "用户刚刚在一个『答案之书』网页上提了一个问题，并随机翻到了一条简短的答案。",
      "请你结合这两个信息，给出一段更细致的回应。",
      "语气温柔、克制，不夸大，也不过度负面，字数控制在 300～600 字之间。",
      "",
      `用户的问题：${question}`,
      `翻到的答案：${currentAnswer}`
    ].join("\n");

    try {
      let reply = "";
      if (selectedProvider === "anthropic") {
        reply = await callAnthropic(key, systemPrompt, userPrompt);
      } else if (selectedProvider === "openai") {
        reply = await callOpenAI(key, systemPrompt, userPrompt);
      } else if (selectedProvider === "gemini") {
        reply = await callGemini(key, systemPrompt, userPrompt);
      } else if (selectedProvider === "deepseek") {
        reply = await callDeepSeek(key, systemPrompt, userPrompt);
      }

      if (!reply) {
        throw new Error("未能从模型中获得内容。");
      }

      deepContent.textContent = reply.trim();
      if (placeholder) {
        placeholder.textContent = "";
      }
    } catch (err) {
      console.error(err);
      alert(
        "调用大模型时出现了问题，请检查你的网络状况、API Key 是否正确和额度是否充足。"
      );
    } finally {
      deepAnswerBtn.disabled = false;
      deepAnswerBtn.textContent = "获取深度解答";
    }
  });
});

// 各家大模型的调用封装（前端直连）
async function callAnthropic(apiKey, systemPrompt, userPrompt) {
  const body = {
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 800,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt
      }
    ]
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error("Anthropic API error");
  }
  const data = await res.json();
  if (!data || !data.content || !data.content[0] || !data.content[0].text) {
    return "";
  }
  return data.content[0].text;
}

async function callOpenAI(apiKey, systemPrompt, userPrompt) {
  const body = {
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: 800
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error("OpenAI API error");
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text === "string") {
    return text;
  }
  if (Array.isArray(text)) {
    return text.map((p) => (typeof p === "string" ? p : p.text || "")).join("");
  }
  return "";
}

async function callGemini(apiKey, systemPrompt, userPrompt) {
  const model = "gemini-1.5-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: `系统提示词：${systemPrompt}\n\n请根据以下信息进行回答：\n${userPrompt}` }
        ]
      }
    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error("Gemini API error");
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || "";
}

async function callDeepSeek(apiKey, systemPrompt, userPrompt) {
  const body = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: 800
  };

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error("DeepSeek API error");
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  return text || "";
}

