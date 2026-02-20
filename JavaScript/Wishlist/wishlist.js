class WishlistManager {
  constructor() {
    this.wishlist = [];
    this.loadWishlist();
  }

  loadWishlist() {
    this.fetchWishlistFromServer();
  }

  async fetchWishlistFromServer() {
    try {
      const response = await fetch("/api/wishlist", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.wishlist = data.wishlist || [];
        this.renderWishlist();
      }
    } catch (error) {
      console.error("Error fetching wishlist:", error);
    }
  }

  addCard(card, priority = "medium") {
    const mappedCard = {
      id: card.id,
      name: card.name,
      setName: card.set?.name || card.episode?.name || "Unknown Set",
      setId: card.set?.id || card.episode?.id || "",
      number: card.number || card.card_number,
      rarity: card.rarity || "Unknown",
      imageLarge: card.images?.large || card.image,
      imageSmall: card.images?.small || card.image,
      tcgplayerPrice:
        card.tcgplayer?.prices?.normal?.market ||
        card.price?.tcg_player?.market_price ||
        0,
      cardmarketPrice:
        card.cardmarket?.prices?.averageSellPrice ||
        card.price?.cardmarket?.lowest_near_mint ||
        0,
      selectedGrade: card.selectedGrade || "raw",
      gradedPrices: card.gradedPrices || {
        psa9: 0,
        psa10: 0,
        beckett9: 0,
        beckett10: 0,
      },
    };

    return this.addToWishlist(mappedCard, priority);
  }

  isInWishlist(cardId) {
    return this.wishlist.some((item) => item.card_id === cardId);
  }

  async addToWishlist(card, priority = "medium") {
    try {
      const gradedPrices = card.gradedPrices || {
        psa9: 0,
        psa10: 0,
        beckett9: 0,
        beckett10: 0,
      };

      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          card_id: card.id,
          name: card.name,
          setName: card.setName,
          number: card.number,
          rarity: card.rarity,
          imageLarge: card.imageLarge,
          imageSmall: card.imageSmall,
          priority,
          price: Math.max(card.tcgplayerPrice || 0, card.cardmarketPrice || 0),
          selectedGrade: card.selectedGrade || "raw",
          gradedPrices: gradedPrices,
        }),
      });

      const data = await response.json();
      if (data.success) {
        this.wishlist.push(data.item);
        this.renderWishlist();
        this.showNotification("Card added to wishlist!", "success");
        return true;
      } else {
        this.showNotification(data.message || "Failed to add card", "error");
        return false;
      }
    } catch (error) {
      console.error("Error adding to wishlist:", error);
      this.showNotification("Error adding card to wishlist", "error");
      return false;
    }
  }

  async removeFromWishlist(itemId) {
    try {
      const response = await fetch(`/api/wishlist/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();
      if (data.success) {
        this.wishlist = this.wishlist.filter((item) => item.id !== itemId);
        this.renderWishlist();
        this.showNotification("Card removed from wishlist", "success");
      }
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      this.showNotification("Error removing card", "error");
    }
  }

  async updatePriority(itemId, priority) {
    try {
      const response = await fetch(`/api/wishlist/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priority }),
      });

      const data = await response.json();
      if (data.success) {
        const item = this.wishlist.find((w) => w.id === itemId);
        if (item) item.priority = priority;
        this.renderWishlist();
        this.showNotification("Priority updated", "success");
      }
    } catch (error) {
      console.error("Error updating priority:", error);
    }
  }

  getImageUrl(item) {
    // ✅ Check database columns first (lowercase from server.js)
    return (
      item.imagelarge || // From database
      item.imagesmall || // From database
      item.imageLarge || // Fallback
      item.imageSmall || // Fallback
      item.image || // Fallback
      "/pictures/placeholder.png" // Last resort
    );
  }

  getGradedPrices(item) {
    try {
      if (item.gradedPrices && typeof item.gradedPrices === "object") {
        return item.gradedPrices;
      }
      if (typeof item.gradedprices === "string") {
        return JSON.parse(item.gradedprices || "{}");
      }
      return item.gradedPrices || {};
    } catch (error) {
      console.error("Error parsing graded prices:", error);
      return {};
    }
  }

  getPriceByGrade(item, grade) {
    if (grade === "raw") {
      return parseFloat(item.price) || 0;
    }
    const graded = this.getGradedPrices(item);
    return parseFloat(graded[grade]) || 0;
  }

  async updateGrade(itemId, grade) {
    const item = this.wishlist.find((w) => w.id === itemId);
    if (!item) return;

    item.selectedgrade = grade;
    item.selectedGrade = grade;
    this.renderWishlist();

    try {
      await fetch(`/api/wishlist/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ selectedGrade: grade }),
      });
    } catch (error) {
      console.error("Error updating grade:", error);
    }
  }

  async updateGradePrice(itemId, grade, value) {
    const item = this.wishlist.find((w) => w.id === itemId);
    if (!item) return;

    const gradedPrices = this.getGradedPrices(item);
    gradedPrices[grade] = parseFloat(value) || 0;

    item.gradedPrices = gradedPrices;
    item.gradedprices = JSON.stringify(gradedPrices);

    this.renderWishlist();

    try {
      await fetch(`/api/wishlist/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gradedPrices }),
      });
    } catch (error) {
      console.error("Error updating graded prices:", error);
    }
  }

  getPriorityStars(priority) {
    const starCount = {
      low: 1,
      medium: 2,
      high: 3,
    };
    const count = starCount[priority] || 2;
    const stars = [];
    for (let i = 1; i <= 3; i++) {
      stars.push(
        `<span class="star ${i <= count ? "active" : ""}" onclick="wishlistManager.updatePriority(${this.id}, '${["low", "medium", "high"][i - 1]}')">★</span>`,
      );
    }
    return stars.join("");
  }

  renderWishlist() {
    const container = document.getElementById("wishlist-grid");
    if (!container) return;

    this.updateStatistics();

    if (this.wishlist.length === 0) {
      const emptyState = document.getElementById("empty-state");
      if (emptyState) emptyState.style.display = "block";
      container.innerHTML = "";
      return;
    }

    const emptyState = document.getElementById("empty-state");
    if (emptyState) emptyState.style.display = "none";

    container.innerHTML = this.wishlist
      .map((item) => {
        const graded = this.getGradedPrices(item);
        const imageUrl = this.getImageUrl(item);
        const starCount = { low: 1, medium: 2, high: 3 }[item.priority] || 2;
        const stars = Array(3)
          .fill(0)
          .map(
            (_, i) =>
              `<span class="star ${i < starCount ? "active" : ""}" data-item-id="${item.id}" data-priority="${["low", "medium", "high"][i]}" style="cursor: pointer;">★</span>`,
          )
          .join("");

        const selectedGrade = item.selectedgrade || item.selectedGrade || "raw";
        const gradePrice = this.getPriceByGrade(item, selectedGrade);

        return `
      <div class="wishlist-card">
        <img src="${imageUrl}" alt="${item.name}" onerror="this.src='/pictures/placeholder.png'">
        <h3>${item.name}</h3>
        <div class="wishlist-card-info">
          <p><strong>Set:</strong> ${item.setName || item.setname || "Unknown"}</p>
          <p><strong>Number:</strong> ${item.number}</p>
          <p><strong>Rarity:</strong> ${item.rarity || "N/A"}</p>
          <p><strong>Price:</strong> $${gradePrice.toFixed(2)}</p>
        </div>

        <div class="grade-selector">
          <label for="grade-${item.id}"><strong>Grade:</strong></label>
          <select id="grade-${item.id}" class="grade-select" data-item-id="${item.id}" onchange="wishlistManager.updateGrade(${item.id}, this.value)">
            <option value="raw" ${selectedGrade === "raw" ? "selected" : ""}>Raw</option>
            <option value="psa9" ${selectedGrade === "psa9" ? "selected" : ""}>PSA 9</option>
            <option value="psa10" ${selectedGrade === "psa10" ? "selected" : ""}>PSA 10</option>
            <option value="beckett9" ${selectedGrade === "beckett9" ? "selected" : ""}>Beckett 9</option>
            <option value="beckett10" ${selectedGrade === "beckett10" ? "selected" : ""}>Beckett 10</option>
          </select>
        </div>

        <div class="grade-price-editor">
          <label><strong>Set Graded Prices:</strong></label>
          <div class="price-inputs">
            <div class="price-input-group">
              <label>PSA 9</label>
              <input type="number" class="price-input" value="${graded.psa9 || 0}" min="0" step="0.01" onchange="wishlistManager.updateGradePrice(${item.id}, 'psa9', this.value)">
            </div>
            <div class="price-input-group">
              <label>PSA 10</label>
              <input type="number" class="price-input" value="${graded.psa10 || 0}" min="0" step="0.01" onchange="wishlistManager.updateGradePrice(${item.id}, 'psa10', this.value)">
            </div>
            <div class="price-input-group">
              <label>Beckett 9</label>
              <input type="number" class="price-input" value="${graded.beckett9 || 0}" min="0" step="0.01" onchange="wishlistManager.updateGradePrice(${item.id}, 'beckett9', this.value)">
            </div>
            <div class="price-input-group">
              <label>Beckett 10</label>
              <input type="number" class="price-input" value="${graded.beckett10 || 0}" min="0" step="0.01" onchange="wishlistManager.updateGradePrice(${item.id}, 'beckett10', this.value)">
            </div>
          </div>
        </div>

        <div class="wishlist-priority">
          <div class="star-rating">
            ${stars}
          </div>
        </div>
        <button class="btn-remove" onclick="wishlistManager.removeFromWishlist(${item.id})">Remove</button>
      </div>
    `;
      })
      .join("");

    document.querySelectorAll(".star").forEach((star) => {
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemId = parseInt(e.target.dataset.itemId);
        const priority = e.target.dataset.priority;
        this.updatePriority(itemId, priority);
      });
    });
  }

  updateStatistics() {
    const totalCards = this.wishlist.length;

    const getSelectedGrade = (item) =>
      item.selectedgrade || item.selectedGrade || "raw";
    const getEffectivePrice = (item) =>
      this.getPriceByGrade(item, getSelectedGrade(item));

    const totalValue = this.wishlist.reduce(
      (sum, item) => sum + getEffectivePrice(item),
      0,
    );
    const avgValue = totalCards > 0 ? totalValue / totalCards : 0;

    const highPriority = this.wishlist.filter(
      (w) => w.priority === "high",
    ).length;
    const mediumPriority = this.wishlist.filter(
      (w) => w.priority === "medium",
    ).length;
    const lowPriority = this.wishlist.filter(
      (w) => w.priority === "low",
    ).length;

    const sortedByPrice = [...this.wishlist].sort(
      (a, b) => getEffectivePrice(b) - getEffectivePrice(a),
    );
    const mostExpensive = sortedByPrice[0];
    const leastExpensive = sortedByPrice[sortedByPrice.length - 1];

    const updateElement = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    const mostExpensiveDisplay = mostExpensive
      ? `${mostExpensive.name} - $${this.getPriceByGrade(mostExpensive, mostExpensive.selectedgrade || mostExpensive.selectedGrade || "raw").toFixed(2)}`
      : "N/A";

    updateElement("stat-total-cards", totalCards);
    updateElement("stat-total-value", `$${totalValue.toFixed(2)}`);
    updateElement("stat-average-value", `$${avgValue.toFixed(2)}`);
    updateElement("stat-high-priority", highPriority);
    updateElement("stat-medium-priority", mediumPriority);
    updateElement("stat-low-priority", lowPriority);
    updateElement("stat-most-expensive", mostExpensiveDisplay);
    updateElement("stat-least-expensive", leastExpensive?.name || "N/A");
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

  async generateShareLink() {
    try {
      const response = await fetch("/api/wishlist/share", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        this.showNotification(
          data.message || "Failed to generate share link",
          "error",
        );
        return;
      }

      this.showShareModal(data.shareUrl);
    } catch (error) {
      console.error("Error generating share link:", error);
      this.showNotification("Error generating share link", "error");
    }
  }

  async compareWishlists(shareToken) {
    try {
      const response = await fetch("/api/wishlist/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ shareToken }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        this.showNotification(data.message || "Compare failed", "error");
        return;
      }

      this.showComparisonResults(data.comparison);
    } catch (error) {
      console.error("Error comparing wishlists:", error);
      this.showNotification("Error comparing wishlists", "error");
    }
  }

  showShareModal(shareUrl) {
    const modal = document.createElement("div");
    modal.className = "share-modal-overlay";
    modal.innerHTML = `
      <div class="share-modal">
        <div class="modal-header">
          <h2>Share Your Wishlist</h2>
          <button class="modal-close-btn" onclick="this.closest('.share-modal-overlay').remove()">&times;</button>
        </div>
        <div class="modal-content">
          <p>Share this link with friends:</p>
          <div class="share-link-container">
            <input type="text" class="share-link-input" value="${shareUrl}" readonly>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${shareUrl}'); alert('Copied to clipboard!')">Copy</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  showComparisonResults(comparison) {
    const cardHtml = (card) => {
      // ✅ FIX: Get image URL first, then use it
      const imageUrl =
        card.imageLarge ||
        card.imagelarge ||
        card.imageSmall ||
        card.imagesmall ||
        card.image ||
        ""; // Empty string if no image

      return `
        <div style="display:flex; gap:.5rem; align-items:center; padding:.5rem; border:1px solid #eee; border-radius:6px; margin-bottom:.5rem; background:${card.matched ? "#eaffea" : "#fff"};">
          <img src="${imageUrl}" alt="${card.name}" style="width:42px; height:58px; object-fit:cover; border-radius:4px;" onerror="this.style.display='none'">
          <div style="min-width:0;">
            <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.name}</div>
            <div style="font-size:.85rem; color:#666;">${card.setname || "Unknown"} • #${card.number || "N/A"}</div>
          </div>
          <div style="margin-left:auto; font-size:.75rem; font-weight:700; color:${card.matched ? "#1a7f37" : "#666"};">
            ${card.matched ? "MATCH" : ""}
          </div>
        </div>
      `;
    };

    const modal = document.createElement("div");
    modal.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10000;padding:1rem;";
    modal.innerHTML = `
      <div style="background:#fff;border-radius:10px;max-width:1100px;width:100%;max-height:90vh;overflow:auto;padding:1rem 1rem 1.25rem;">
        <h2 style="margin:.25rem 0 1rem;">Wishlist Comparison</h2>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:.75rem;margin-bottom:1rem;">
          <div style="padding:.75rem;border-radius:8px;background:#f7f7f7;text-align:center;"><strong>${comparison.matchingCount}</strong><div>Matching</div></div>
          <div style="padding:.75rem;border-radius:8px;background:#f7f7f7;text-align:center;"><strong>${comparison.onlyYouHave}</strong><div>Only You</div></div>
          <div style="padding:.75rem;border-radius:8px;background:#f7f7f7;text-align:center;"><strong>${comparison.onlyTheyHave}</strong><div>Only ${comparison.friendUsername || "Them"}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div>
            <h3 style="margin:.25rem 0 .75rem;">Your Wishlist</h3>
            ${(comparison.myCards || []).map(cardHtml).join("") || "<p>No cards.</p>"}
          </div>
          <div>
            <h3 style="margin:.25rem 0 .75rem;">${comparison.friendUsername || "Shared"} Wishlist</h3>
            ${(comparison.friendCards || []).map(cardHtml).join("") || "<p>No cards.</p>"}
          </div>
        </div>
        <button onclick="this.closest('div').parentElement.remove()" style="margin-top:1rem;width:100%;padding:.7rem;border:0;border-radius:6px;background:var(--primary-color);color:#fff;font-weight:700;cursor:pointer;">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

const wishlistManager = new WishlistManager();
window.wishlistManager = wishlistManager;
window.generateShareLink = function generateShareLink() {
  return wishlistManager.generateShareLink();
};

window.compareWishlists = function compareWishlists(shareToken) {
  return wishlistManager.compareWishlists(shareToken);
};
