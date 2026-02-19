class BudgetManager {
  constructor() {
    this.budget = [];
    this.budgetLimit = 0;
    this.waitForWishlist(() => {
      this.loadBudget();
      this.loadBudgetLimit();
      this.initializePage();
    });
    this.setupEventListeners();
  }

  waitForWishlist(callback) {
    if (typeof wishlistManager !== "undefined" && wishlistManager.wishlist) {
      callback();
    } else {
      setTimeout(() => this.waitForWishlist(callback), 100);
    }
  }

  async loadBudget() {
    try {
      const response = await fetch("/api/budget", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.budget = data.budget || [];
        this.renderBudgetPage();
        this.updateBudgetStatistics();
      } else if (response.status === 401) {
        console.log("User not logged in");
      }
    } catch (error) {
      console.error("Error loading budget:", error);
    }
  }

  async loadBudgetLimit() {
    try {
      const response = await fetch("/api/budget/limit", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.budgetLimit = data.limit || 0;
        this.updateBudgetStatistics();
      }
    } catch (error) {
      console.error("Error loading budget limit:", error);
    }
  }

  async setBudgetLimit(limit) {
    try {
      const response = await fetch("/api/budget/limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ limit: parseFloat(limit) || 0 }),
      });

      const data = await response.json();
      if (data.success) {
        this.budgetLimit = data.limit;
        this.updateBudgetStatistics();
        this.showNotification(
          `Budget limit set to $${this.budgetLimit.toFixed(2)}`,
          "success",
        );
      }
    } catch (error) {
      console.error("Error setting budget limit:", error);
      this.showNotification("Error setting budget limit", "error");
    }
  }

  async importFromWishlist() {
    if (typeof wishlistManager === "undefined" || !wishlistManager.wishlist) {
      this.showNotification("Wishlist not available", "error");
      return;
    }

    const wishlist = wishlistManager.wishlist;
    if (wishlist.length === 0) {
      this.showNotification("Your wishlist is empty", "info");
      return;
    }

    let importedCount = 0;

    for (const card of wishlist) {
      const cardId = card.card_id || card.id;

      if (!this.isInBudget(cardId)) {
        let gradedPrices = {
          raw: 0,
          psa9: 0,
          psa10: 0,
          beckett9: 0,
          beckett10: 0,
        };

        try {
          if (typeof card.gradedprices === "string") {
            gradedPrices = JSON.parse(card.gradedprices);
          } else if (card.gradedprices) {
            gradedPrices = card.gradedprices;
          }
        } catch (e) {
          console.warn("Could not parse graded prices:", e);
        }

        gradedPrices.raw = parseFloat(card.price) || 0;

        try {
          const response = await fetch("/api/budget", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              card_id: cardId,
              name: card.name,
              imageSmall: card.imagesmall || card.imageSmall,
              imageLarge: card.imagelarge || card.imageLarge,
              setName: card.setname || card.setName,
              setId: card.setid || card.setId,
              number: card.number,
              rarity: card.rarity,
              selectedGrade: card.selectedgrade || "raw",
              prices: gradedPrices,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            this.budget.push(data.item);
            importedCount++;
          }
        } catch (error) {
          console.error("Error importing card:", error);
        }
      }
    }

    if (importedCount > 0) {
      this.showNotification(
        `Imported ${importedCount} card(s) from wishlist`,
        "success",
      );
      this.renderBudgetPage();
      this.updateBudgetStatistics();
    } else {
      this.showNotification(
        "All wishlist cards are already in your budget",
        "info",
      );
    }
  }

  isInBudget(cardId) {
    return this.budget.some((c) => (c.card_id || c.id) === cardId);
  }

  async togglePurchased(itemId) {
    const item = this.budget.find((c) => c.id === itemId);
    if (!item) return;

    try {
      const response = await fetch(`/api/budget/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ purchased: !item.purchased }),
      });

      if (response.ok) {
        const data = await response.json();
        item.purchased = data.item.purchased;
        this.renderBudgetPage();
        this.updateBudgetStatistics();
      }
    } catch (error) {
      console.error("Error toggling purchased:", error);
      this.showNotification("Error updating purchase status", "error");
    }
  }

  async toggleInBudget(itemId) {
    const item = this.budget.find((c) => c.id === itemId);
    if (!item) return;

    try {
      const response = await fetch(`/api/budget/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inBudget: !item.inBudget }),
      });

      if (response.ok) {
        const data = await response.json();
        item.inBudget = data.item.inBudget;
        this.renderBudgetPage();
        this.updateBudgetStatistics();
      }
    } catch (error) {
      console.error("Error toggling in budget:", error);
      this.showNotification("Error updating budget status", "error");
    }
  }

  async removeFromBudget(itemId) {
    try {
      const response = await fetch(`/api/budget/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        this.budget = this.budget.filter((c) => c.id !== itemId);
        this.showNotification("Card removed from budget", "success");
        this.renderBudgetPage();
        this.updateBudgetStatistics();
      }
    } catch (error) {
      console.error("Error removing from budget:", error);
      this.showNotification("Error removing card", "error");
    }
  }

  async updateGrade(itemId, grade) {
    const item = this.budget.find((c) => c.id === itemId);
    if (!item) return;

    item.selectedgrade = grade;
    item.selectedGrade = grade;
    this.renderBudgetPage();

    try {
      const response = await fetch(`/api/budget/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ selectedGrade: grade }),
      });

      if (response.ok) {
        const data = await response.json();
        item.selectedGrade = data.item.selectedgrade;
        this.renderBudgetPage();
        this.updateBudgetStatistics();
      }
    } catch (error) {
      console.error("Error updating grade:", error);
    }
  }

  async updatePrice(itemId, grade, price) {
    const item = this.budget.find((c) => c.id === itemId);
    if (!item) return;

    try {
      const prices =
        typeof item.prices === "string"
          ? JSON.parse(item.prices)
          : item.prices || {};
      prices[grade] = parseFloat(price) || 0;

      const response = await fetch(`/api/budget/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prices }),
      });

      if (response.ok) {
        const data = await response.json();
        item.prices = data.item.prices;
        this.updateBudgetStatistics();
        this.showNotification("Price updated", "success");
      }
    } catch (error) {
      console.error("Error updating price:", error);
      this.showNotification("Error updating price", "error");
    }
  }

  getCardPrice(card) {
    if (!card) return 0;
    const prices =
      typeof card.prices === "string"
        ? JSON.parse(card.prices)
        : card.prices || {};

    const grade = card.selectedgrade || card.selectedGrade || "raw";
    return prices[grade] || 0;
  }

  initializePage() {
    if (window.location.pathname.includes("TCG-budget")) {
      this.renderBudgetPage();
      this.updateBudgetStatistics();
    }
  }

  setupEventListeners() {
    const importBtn = document.getElementById("import-wishlist-btn");
    if (importBtn) {
      importBtn.addEventListener("click", () => this.importFromWishlist());
    }

    const budgetLimitBtn = document.getElementById("budget-limit-btn");
    const budgetLimitInput = document.getElementById("budget-limit-input");

    if (budgetLimitBtn) {
      budgetLimitBtn.addEventListener("click", () => {
        if (budgetLimitInput) {
          this.setBudgetLimit(budgetLimitInput.value);
          budgetLimitInput.value = "";
        }
      });
    }

    if (budgetLimitInput) {
      budgetLimitInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.setBudgetLimit(budgetLimitInput.value);
          budgetLimitInput.value = "";
        }
      });
    }
  }

  renderBudgetPage() {
    const grid = document.getElementById("budget-grid");
    if (!grid) return;

    if (this.budget.length === 0) {
      grid.innerHTML =
        '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">Your budget is empty. <a href="/HTML/TCG-Wishlist.html">Import items from your wishlist</a></p>';
      return;
    }

    grid.innerHTML = this.budget
      .map((card) => this.createBudgetCardHTML(card))
      .join("");

    this.attachEventListeners();
  }

  createBudgetCardHTML(card) {
    const price = this.getCardPrice(card);
    const imageLarge = card.imagelarge || card.imageLarge;
    const imageSmall = card.imagesmall || card.imageSmall;
    const imageUrl = imageLarge || imageSmall || "/pictures/placeholder.png";
    const selected = card.selectedgrade || card.selectedGrade || "raw";

    const graded =
      typeof card.prices === "string"
        ? JSON.parse(card.prices)
        : card.prices || {};

    return `
      <div class="budget-card ${card.purchased ? "purchased" : ""} ${card.inbudget === false ? "out-of-budget" : ""}" data-card-id="${card.id}">
        <img 
          src="${imageUrl}" 
          alt="${card.name}" 
          onerror="this.src='/pictures/placeholder.png'"
          style="width: 100%; height: 300px; object-fit: contain; background: #f5f5f5; border-radius: 4px; margin-bottom: 10px;"
        >
        <h3>${card.name}</h3>
        <div class="budget-card-info">
          <p><strong>Set:</strong> ${card.setname || card.setName || "Unknown"}</p>
          <p><strong>Number:</strong> ${card.number || "N/A"}</p>
          <p><strong>Rarity:</strong> ${card.rarity || "N/A"}</p>
          <p><strong>Price:</strong> $${price.toFixed(2)}</p>
        </div>

        <div class="grade-price-editor">
          <label for="grade-${card.id}"><strong>Grade:</strong></label>
          <select id="grade-${card.id}" class="grade-select" data-item-id="${card.id}" onchange="budgetManager.updateGrade(${card.id}, this.value)">
            <option value="raw" ${selected === "raw" ? "selected" : ""}>Raw</option>
            <option value="psa9" ${selected === "psa9" ? "selected" : ""}>PSA 9</option>
            <option value="psa10" ${selected === "psa10" ? "selected" : ""}>PSA 10</option>
            <option value="beckett9" ${selected === "beckett9" ? "selected" : ""}>Beckett 9</option>
            <option value="beckett10" ${selected === "beckett10" ? "selected" : ""}>Beckett 10</option>
          </select>
        </div>

        <div class="grade-input-editor">
          <label><strong>Set Graded Prices:</strong></label>
          <div class="price-inputs">
            <div class="price-input-group">
              <label>Raw</label>
              <input type="number" class="price-input" value="${graded.raw || 0}" min="0" step="0.01" onchange="budgetManager.updatePrice(${card.id}, 'raw', this.value)">
            </div>
            <div class="price-input-group">
              <label>PSA 10</label>
              <input type="number" class="price-input" value="${graded.psa10 || 0}" min="0" step="0.01" onchange="budgetManager.updatePrice(${card.id}, 'psa10', this.value)">
            </div>
            <div class="price-input-group">
              <label>Beckett 10</label>
              <input type="number" class="price-input" value="${graded.beckett10 || 0}" min="0" step="0.01" onchange="budgetManager.updatePrice(${card.id}, 'beckett10', this.value)">
            </div>
          </div>
        </div>

        <div class="budget-actions">
          <button class="btn-purchased ${card.purchased ? "active" : ""}" onclick="budgetManager.togglePurchased(${card.id})">
            ${card.purchased ? "✓ Purchased" : "Not Purchased"}
          </button>
          <button class="btn-budget ${card.inbudget ? "active" : ""}" onclick="budgetManager.toggleInBudget(${card.id})">
            ${card.inbudget ? "In Budget" : "Out of Budget"}
          </button>
          <button class="btn-remove" onclick="budgetManager.removeFromBudget(${card.id})">
            Remove
          </button>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Event listeners are now handled by onclick attributes
  }

  updateBudgetStatistics() {
    const inBudgetCards = this.budget.filter((c) => c.inbudget !== false);
    const totalInBudget = inBudgetCards.length;
    const purchasedCards = inBudgetCards.filter((c) => c.purchased).length;
    const unpurchasedCards = inBudgetCards.filter((c) => !c.purchased).length;

    const totalBudget = inBudgetCards.reduce(
      (sum, card) => sum + this.getCardPrice(card),
      0,
    );

    const purchasedTotal = inBudgetCards
      .filter((c) => c.purchased)
      .reduce((sum, card) => sum + this.getCardPrice(card), 0);

    const remainingBudget = this.budgetLimit - purchasedTotal;

    const updateElement = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    updateElement("budget-stat-total-cards", totalInBudget);
    updateElement("budget-stat-purchased", purchasedCards);
    updateElement("budget-stat-unpurchased", unpurchasedCards);
    updateElement("budget-stat-total-value", `$${totalBudget.toFixed(2)}`);
    updateElement("budget-stat-spent", `$${purchasedTotal.toFixed(2)}`);
    updateElement(
      "budget-stat-budget-limit",
      `$${this.budgetLimit.toFixed(2)}`,
    );
    updateElement("budget-stat-remaining", `$${remainingBudget.toFixed(2)}`);

    const budgetStatus = document.getElementById("budget-status");
    if (budgetStatus) {
      if (this.budgetLimit > 0 && purchasedTotal > this.budgetLimit) {
        budgetStatus.textContent = "⚠️ Over Budget!";
        budgetStatus.style.color = "#ff4444";
      } else if (this.budgetLimit > 0) {
        budgetStatus.textContent = "✓ Within Budget";
        budgetStatus.style.color = "#4CAF50";
      } else {
        budgetStatus.textContent = "No limit set";
        budgetStatus.style.color = "#2196F3";
      }
    }
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add("show");
    });

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

const budgetManager = new BudgetManager();
