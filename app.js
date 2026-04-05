(function () {
  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });

  const pages = [
    { title: "Home dashboard", url: "index.html", keywords: "overview tools budget cash flow" },
    { title: "Finance calculators", url: "calculators.html", keywords: "loan interest retirement emergency savings" },
    { title: "Budget planner", url: "planner.html", keywords: "budget monthly expenses tracker net worth balance sheet debt score" }
  ];

  const themeToggle = document.getElementById("theme-toggle");
    const savedTheme = storage.get("financy-theme", "light");
  document.body.dataset.theme = savedTheme;

  function syncThemeToggle() {
    if (!themeToggle) return;
    const isDark = document.body.dataset.theme === "dark";
    themeToggle.textContent = isDark ? "☀" : "☾";
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    themeToggle.setAttribute("title", isDark ? "Switch to light mode" : "Switch to dark mode");
  }

  syncThemeToggle();

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
      document.body.dataset.theme = nextTheme;
      storage.set("financy-theme", nextTheme);
      syncThemeToggle();
    });
  }

  function numberValue(form, name) {
    return Number(form.elements[name]?.value || 0);
  }

  function formatMoney(value) {
    return currency.format(Number.isFinite(value) ? value : 0);
  }

  function setMeter(id, percent) {
    const node = document.getElementById(id);
    if (node) node.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function updateSearch() {
    const input = document.getElementById("site-search");
    const results = document.getElementById("search-results");
    if (!input || !results) return;

    const localItems = [...document.querySelectorAll(".searchable")].map((item) => ({
      title: item.querySelector("h2, h3")?.textContent || "Section",
      url: `${location.pathname.split("/").pop() || "index.html"}${item.id ? `#${item.id}` : ""}`,
      keywords: item.dataset.title || "",
      description: item.querySelector("p, .result-box")?.textContent || "Jump to section"
    }));

    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      if (!query) {
        results.classList.add("hidden");
        results.innerHTML = "";
        return;
      }

      const hits = [...pages, ...localItems]
        .filter((item) => `${item.title} ${item.keywords} ${item.description || ""}`.toLowerCase().includes(query))
        .slice(0, 8);

      results.innerHTML = hits.length
        ? hits.map((hit) => `<a class="search-hit" href="${hit.url}"><strong>${hit.title}</strong><div>${hit.description || hit.keywords}</div></a>`).join("")
        : `<div class="search-hit"><strong>No matches</strong><div>Try budget, loans, retirement, or net worth.</div></div>`;
      results.classList.remove("hidden");
    });

    document.addEventListener("click", (event) => {
      if (!results.contains(event.target) && event.target !== input) {
        results.classList.add("hidden");
      }
    });
  }

  function initSectionGlow() {
    const glowSections = document.querySelectorAll(".matte-card, .hero-panel, .tool-card");
    glowSections.forEach((section) => {
      section.addEventListener("pointermove", (event) => {
        const rect = section.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        section.style.setProperty("--glow-x", `${x}px`);
        section.style.setProperty("--glow-y", `${y}px`);
        section.classList.add("glow-active");
      });

      section.addEventListener("pointerenter", () => {
        section.classList.add("glow-active");
      });

      section.addEventListener("pointerleave", () => {
        section.classList.remove("glow-active");
      });
    });
  }

  function initBudget() {
    const form = document.getElementById("budget-form");
    if (!form) return;

    const saved = storage.get("gptmoney-budget", null);
    if (saved) {
      Object.entries(saved).forEach(([key, value]) => {
        if (form.elements[key]) form.elements[key].value = value;
      });
    }

    const calculate = () => {
      const budget = {
        income: numberValue(form, "income"),
        housing: numberValue(form, "housing"),
        utilities: numberValue(form, "utilities"),
        groceries: numberValue(form, "groceries"),
        transportation: numberValue(form, "transportation"),
        insurance: numberValue(form, "insurance"),
        debt: numberValue(form, "debt"),
        personal: numberValue(form, "personal"),
        saving: numberValue(form, "saving")
      };
      const spent = Object.values(budget).slice(1).reduce((sum, value) => sum + value, 0);
      const leftover = budget.income - spent;
      const savingsRate = budget.income ? (budget.saving / budget.income) * 100 : 0;
      storage.set("gptmoney-budget", budget);
      const big = document.getElementById("budget-big-value");
      const summary = document.getElementById("budget-summary");
      if (big) big.textContent = formatMoney(leftover);
      if (summary) summary.textContent = `Spent ${formatMoney(spent)} this month with a savings rate of ${savingsRate.toFixed(1)}%.`;
      setMeter("budget-meter", budget.income ? (Math.max(0, leftover) / budget.income) * 100 : 0);
      syncHomeAndInsights();
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      calculate();
    });

    calculate();
  }

  function initExpenses() {
    const form = document.getElementById("expense-form");
    if (!form) return;
    const list = document.getElementById("expense-list");
    const totalLabel = document.getElementById("expense-total");
    const clearButton = document.getElementById("clear-expenses");

    let expenses = storage.get("gptmoney-expenses", []);

    const render = () => {
      const total = expenses.reduce((sum, item) => sum + item.amount, 0);
      totalLabel.textContent = `Tracked expenses: ${formatMoney(total)}`;
      const big = document.getElementById("expense-big-value");
      if (big) big.textContent = formatMoney(total);
      setMeter("expense-meter", Math.min(100, total / 50));
      list.innerHTML = expenses.length
        ? expenses.map((item, index) => `
            <div class="expense-item">
              <span>${item.label}</span>
              <div class="row-actions">
                <strong>${formatMoney(item.amount)}</strong>
                <button class="pill-button secondary" data-expense-remove="${index}" type="button">Remove</button>
              </div>
            </div>`).join("")
        : `<div class="result-box">No expenses added yet.</div>`;

      list.querySelectorAll("[data-expense-remove]").forEach((button) => {
        button.addEventListener("click", () => {
          expenses.splice(Number(button.dataset.expenseRemove), 1);
          storage.set("gptmoney-expenses", expenses);
          render();
        });
      });
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const label = form.elements.label.value.trim();
      const amount = Number(form.elements.amount.value);
      if (!label || !amount) return;
      expenses.unshift({ label, amount });
      expenses = expenses.slice(0, 12);
      storage.set("gptmoney-expenses", expenses);
      form.reset();
      render();
    });

    clearButton.addEventListener("click", () => {
      expenses = [];
      storage.set("gptmoney-expenses", expenses);
      render();
    });

    render();
  }

  function initCalculators() {
    const configs = [
      {
        formId: "loan-form",
        key: "gptmoney-loan",
        run(form) {
          const amount = numberValue(form, "amount");
          const monthlyRate = numberValue(form, "apr") / 100 / 12;
          const months = numberValue(form, "years") * 12;
          const payment = monthlyRate === 0 ? amount / months : amount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
          return {
            text: `Estimated monthly payment: ${formatMoney(payment)} over ${months} months. Total paid: ${formatMoney(payment * months)}.`,
            bigValue: formatMoney(payment),
            summary: `${months} monthly payments with ${formatMoney(payment * months - amount)} in interest over the term.`,
            meter: amount ? (payment / amount) * 100 : 0
          };
        }
      },
      {
        formId: "compound-form",
        key: "gptmoney-compound",
        run(form) {
          const principal = numberValue(form, "principal");
          const monthly = numberValue(form, "monthly");
          const monthlyRate = numberValue(form, "rate") / 100 / 12;
          const months = numberValue(form, "years") * 12;
          let value = principal;
          for (let i = 0; i < months; i += 1) value = value * (1 + monthlyRate) + monthly;
          const contributions = principal + monthly * months;
          return {
            text: `Projected value: ${formatMoney(value)} after ${months / 12} years. Contributions: ${formatMoney(contributions)}.`,
            bigValue: formatMoney(value),
            summary: `${formatMoney(value - contributions)} of the projection comes from growth, not just contributions.`,
            meter: value ? (contributions / value) * 100 : 0
          };
        }
      },
      {
        formId: "emergency-form",
        key: "gptmoney-emergency",
        run(form) {
          const expenses = numberValue(form, "expenses");
          const months = numberValue(form, "months");
          const goal = expenses * months;
          storage.set("gptmoney-emergency-goal", { expenses, months, goal });
          syncHomeAndInsights();
          return {
            text: `Emergency fund target: ${formatMoney(goal)} for ${months} months of coverage.`,
            bigValue: formatMoney(goal),
            summary: `That covers ${months} months of essentials at ${formatMoney(expenses)} per month.`,
            meter: (months / 12) * 100
          };
        }
      },
      {
        formId: "retirement-form",
        key: "gptmoney-retirement",
        run(form) {
          const years = numberValue(form, "retireAge") - numberValue(form, "currentAge");
          const monthlyRate = numberValue(form, "rate") / 100 / 12;
          const months = years * 12;
          let value = numberValue(form, "balance");
          const monthly = numberValue(form, "monthly");
          for (let i = 0; i < months; i += 1) value = value * (1 + monthlyRate) + monthly;
          return {
            text: `Projected retirement balance: ${formatMoney(value)} by age ${numberValue(form, "retireAge")}.`,
            bigValue: formatMoney(value),
            summary: `${years} years of contributions can build a much larger balance if you stay consistent.`,
            meter: Math.min(100, value / 10000)
          };
        }
      }
    ];

    configs.forEach((config) => {
      const form = document.getElementById(config.formId);
      if (!form) return;

      const saved = storage.get(config.key, null);
      if (saved) {
        Object.entries(saved).forEach(([key, value]) => {
          if (form.elements[key]) form.elements[key].value = value;
        });
      }

      const compute = () => {
        const values = Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, Number(value)]));
        storage.set(config.key, values);
        const output = config.run(form);
        const prefix = config.formId.replace("-form", "");
        const big = document.getElementById(`${prefix}-big-value`);
        const summary = document.getElementById(`${prefix}-summary`);
        if (big) big.textContent = output.bigValue;
        if (summary) summary.textContent = output.summary;
        setMeter(`${prefix}-meter`, output.meter);
      };

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        compute();
      });

      compute();
    });
  }

  function initNetWorth() {
    const form = document.getElementById("networth-form");
    if (!form) return;
    const saved = storage.get("gptmoney-networth", null);
    if (saved) {
      Object.entries(saved).forEach(([key, value]) => {
        if (form.elements[key]) form.elements[key].value = value;
      });
    }

    const compute = () => {
      const data = {
        cash: numberValue(form, "cash"),
        investments: numberValue(form, "investments"),
        property: numberValue(form, "property"),
        cards: numberValue(form, "cards"),
        loans: numberValue(form, "loans"),
        securedDebt: numberValue(form, "securedDebt")
      };
      const assets = data.cash + data.investments + data.property;
      const liabilities = data.cards + data.loans + data.securedDebt;
      const netWorth = assets - liabilities;
      storage.set("gptmoney-networth", { ...data, assets, liabilities, netWorth });
      const big = document.getElementById("networth-big-value");
      const summary = document.getElementById("networth-summary");
      if (big) big.textContent = formatMoney(netWorth);
      if (summary) summary.textContent = `You have ${formatMoney(assets)} and owe ${formatMoney(liabilities)}.`;
      setMeter("networth-meter", assets ? (Math.max(0, netWorth) / assets) * 100 : 0);
      syncHomeAndInsights();
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      compute();
    });

    compute();
  }

  function syncHomeAndInsights() {
    const budget = storage.get("gptmoney-budget", {});
    const networth = storage.get("gptmoney-networth", { assets: 0, liabilities: 0, netWorth: 0 });
    const emergency = storage.get("gptmoney-emergency-goal", { goal: 0, months: 0 });

    const spent = ["housing", "utilities", "groceries", "transportation", "insurance", "debt", "personal", "saving"]
      .reduce((sum, key) => sum + Number(budget[key] || 0), 0);
    const cashflow = Number(budget.income || 0) - spent;
    const savingsRate = budget.income ? ((Number(budget.saving || 0) / Number(budget.income)) * 100) : 0;

    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };

    setText("home-leftover", formatMoney(cashflow));
    setText("home-savings-rate", `${savingsRate.toFixed(1)}%`);
    setMeter("home-leftover-meter", budget.income ? (Math.max(0, cashflow) / Number(budget.income)) * 100 : 0);
    setMeter("home-savings-meter", Math.min(100, savingsRate));
    setMeter("home-networth-meter", networth.assets ? (Math.max(0, networth.netWorth) / networth.assets) * 100 : 0);

    setText("assets-total", formatMoney(networth.assets || 0));
    setText("liabilities-total", formatMoney(networth.liabilities || 0));
    setText("insight-networth", formatMoney(networth.netWorth || 0));
    setText("bill-housing", formatMoney(Number(budget.housing || 0) + Number(budget.utilities || 0)));
    setText("bill-transport", formatMoney(Number(budget.transportation || 0) + Number(budget.insurance || 0)));
    setText("bill-debt", formatMoney(Number(budget.debt || 0)));

    const savingsScore = Math.max(0, Math.min(100, Math.round(savingsRate * 4)));
    const debtRatio = budget.income ? ((Number(budget.debt || 0) + Number(budget.insurance || 0)) / Number(budget.income)) * 100 : 0;
    const debtScore = Math.max(0, Math.min(100, Math.round(100 - debtRatio * 2)));
    const savingsLabel = document.getElementById("savings-score-label");
    const debtLabel = document.getElementById("debt-score-label");
    const savingsBar = document.getElementById("savings-score-bar");
    const debtBar = document.getElementById("debt-score-bar");

    if (savingsLabel) savingsLabel.textContent = `${savingsScore} / 100`;
    if (debtLabel) debtLabel.textContent = `${debtScore} / 100`;
    if (savingsBar) savingsBar.style.width = `${savingsScore}%`;
    if (debtBar) debtBar.style.width = `${debtScore}%`;
    setText("signals-summary", `Savings score tracks how much of your income you keep. Debt load falls as required payments take less of your income.`);
  }

  function initAiBar() {
    const dock = document.getElementById("ai-dock");
    const form = document.getElementById("ai-form");
    const input = document.getElementById("ai-input");
    const log = document.getElementById("ai-log");
    const toggleButton = document.getElementById("ai-clear");
    if (!dock || !form || !input || !log || !toggleButton) return;

    let minimized = storage.get("gptmoney-ai-minimized", true);
    let history = storage.get("financy-ai-history", []);

    const syncDock = () => {
      dock.classList.toggle("minimized", minimized);
      toggleButton.textContent = minimized ? "AI" : "×";
      toggleButton.setAttribute("aria-label", minimized ? "Open AI bar" : "Minimize AI bar");
      toggleButton.setAttribute("title", minimized ? "Open AI bar" : "Minimize AI bar");
    };

    const render = () => {
      log.innerHTML = history.slice(-6).map((item) => `<div class="ai-msg ${item.role}">${item.text}</div>`).join("");
      log.scrollTop = log.scrollHeight;
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) return;
      if (minimized) return;
      history.push({ role: "user", text: question });
      history.push({ role: "assistant", text: "Unable to connect." });
      history = history.slice(-12);
      input.value = "";
      storage.set("financy-ai-history", history);
      render();
    });

    toggleButton.addEventListener("click", () => {
      minimized = !minimized;
      storage.set("gptmoney-ai-minimized", minimized);
      syncDock();
      if (!minimized) input.focus();
    });

    render();
    syncDock();
  }

  updateSearch();
  initSectionGlow();
  initBudget();
  initExpenses();
  initCalculators();
  initNetWorth();
  syncHomeAndInsights();
  initAiBar();
})();
