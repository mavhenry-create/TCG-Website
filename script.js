// Instantiate the SDK
const tcgdex = new TCGdex("en");

// Global variables to store search results and current state
let allCards = [];
let currentPage = 1;
let cardsPerPage = 20; // Default, can be changed by user
let blockedCards = []; // For debugging: store blocked cards
let setsMap = {}; // Map of set IDs to names

// Example: Fetch a specific card (this runs immediately when the script loads)
(async () => {
  try {
    const card = await tcgdex.fetch("cards", "swsh3-136");
    console.log("Example card:", card.name); // "Furret"
  } catch (error) {
    console.error("Error fetching example card:", error);
  }
})();

// Load sets data
(async () => {
  try {
    const sets = await tcgdex.fetch("sets");
    sets.forEach((set) => {
      setsMap[set.id] = set.name;
    });
    console.log("Loaded sets map:", setsMap);
  } catch (error) {
    console.error("Error loading sets data:", error);
  }
})();

// Function to search for cards based on user input
async function searchCards() {
  try {
    // Get the user's input from the text field
    const pokemonCard = document
      .getElementById("pokemonCard")
      .value.toLowerCase()
      .trim();

    // Use REST API for name search (empty search will return limited results)
    const response = await fetch(
      `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(
        pokemonCard,
      )}`,
    );
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const cards = await response.json();

    if (cards && cards.length > 0) {
      blockedCards = []; // Reset blocked cards

      // Fetch full card details for all cards to get complete set information
      console.log("Fetching full details for", cards.length, "cards");
      const fullCardPromises = cards
        .filter((card) => card && card.id) // Only fetch cards with valid IDs
        .map((card) =>
          fetch(`https://api.tcgdex.net/v2/en/cards/${card.id}`)
            .then((response) => (response.ok ? response.json() : null))
            .catch((error) => {
              console.error(`Error fetching card ${card.id}:`, error);
              return null;
            }),
        );

      const fullCards = await Promise.all(fullCardPromises);
      const validFullCards = fullCards.filter((card) => card !== null);

      console.log("Fetched", validFullCards.length, "full card details");

      // Filter out digital-only cards (cards that exist only in video games/mobile apps)
      const physicalCards = validFullCards.filter((card) => {
        // Cards without set information get a pass (assume physical until proven otherwise)
        if (!card.set) {
          // But check if the card ID itself indicates TCGP
          if (
            card.id &&
            (card.id.startsWith("A") ||
              card.id.startsWith("B") ||
              card.id.startsWith("P-"))
          ) {
            blockedCards.push({
              card,
              reason: `Card ID indicates TCGP: ${card.id}`,
            });
            return false;
          }
          console.log(`PASS: ${card.name} - no set info`);
          return true;
        }

        // Reject cards with incomplete set info that look suspicious
        if (!card.set.id || !card.set.name) {
          // If it has a serie that's TCGP, block it
          if (card.set.serie && card.set.serie.id === "tcgp") {
            blockedCards.push({ card, reason: "TCGP serie" });
            return false;
          }
          // If it has an invalid rarity, block it (likely digital)
          if (card.rarity && !validPhysicalRarities.includes(card.rarity)) {
            blockedCards.push({
              card,
              reason: `invalid rarity: ${card.rarity}`,
            });
            return false;
          }
          // Otherwise, give it a pass (assume physical until proven otherwise)
          console.log(
            `PASS: ${card.name} - incomplete set but no TCGP serie or invalid rarity`,
          );
          return true;
        }

        // PRIORITY: Check for TCGP pattern FIRST (any set starting with A, B, or P-)
        if (
          card.set.id &&
          (card.set.id.startsWith("A") ||
            card.set.id.startsWith("B") ||
            card.set.id.startsWith("P-"))
        ) {
          blockedCards.push({
            card,
            reason: `TCGP ID pattern: ${card.set.id}`,
          });
          return false; // Block ALL TCGP sets
        }

        // Check for TCGP set names (catch any that might have different ID patterns)
        const tcgpSetNames = [
          "Genetic Apex",
          "Mythical Island",
          "Space-Time Smackdown",
          "Triumphant Light",
          "Shining Revelry",
          "Celestial Guardians",
          "Extradimensional Crisis",
          "Eevee Grove",
          "Wisdom of Sea and Sky",
          "Secluded Springs",
          "Mega Rising",
          "Crimson Blaze",
        ];
        if (
          card.set.name &&
          tcgpSetNames.some((name) => card.set.name.includes(name))
        ) {
          blockedCards.push({
            card,
            reason: `TCGP set name: ${card.set.name}`,
          });
          return false; // Block by set name
        }

        // Check for TCGP-related keywords in set names
        if (
          card.set.name &&
          (card.set.name.toLowerCase().includes("apex") ||
            card.set.name.toLowerCase().includes("revelry") ||
            card.set.name.toLowerCase().includes("smackdown") ||
            card.set.name.toLowerCase().includes("celestial") ||
            card.set.name.toLowerCase().includes("extradimensional") ||
            card.set.name.toLowerCase().includes("mega rising") ||
            card.set.name.toLowerCase().includes("crimson"))
        ) {
          blockedCards.push({
            card,
            reason: `TCGP keyword in set name: ${card.set.name}`,
          });
          return false; // Block TCGP sets by keyword
        }

        // Known digital-only series
        const digitalSeries = ["tcgp"]; // Pokémon TCG Pocket

        // Check if card is from a digital-only series
        if (card.set.serie && digitalSeries.includes(card.set.serie.id)) {
          blockedCards.push({
            card,
            reason: `digital series: ${card.set.serie.id}`,
          });
          return false;
        }

        // Also check for any serie that contains "pocket" or "tcg" in the name
        if (
          card.set.serie &&
          (card.set.serie.name.toLowerCase().includes("pocket") ||
            card.set.serie.name.toLowerCase().includes("tcg"))
        ) {
          blockedCards.push({
            card,
            reason: `serie name contains pocket/tcg: ${card.set.serie.name}`,
          });
          return false;
        }

        // Check for digital-only set names (video games/mobile apps)
        const digitalSetNames = [
          "Pokémon Masters",
          "Masters EX",
          "Trading Card Game Pocket",
          "TCG Pocket",
        ];
        if (digitalSetNames.some((name) => card.set.name.includes(name))) {
          blockedCards.push({
            card,
            reason: `digital set name: ${card.set.name}`,
          });
          return false;
        }

        // Check for promotional digital sets
        const digitalSetIds = [
          // fut2020 and swsh10.5 removed - these are real physical sets
        ];
        if (digitalSetIds.includes(card.set.id)) {
          blockedCards.push({ card, reason: `digital set ID: ${card.set.id}` });
          return false;
        }

        // Check for valid physical TCG rarities (ONLY allow these exact rarities)
        const validPhysicalRarities = [
          "Common",
          "Uncommon",
          "Rare",
          "Double Rare",
          "Ultra Rare",
          "Shiny Ultra Rare",
          "Illustration Rare",
          "Special Illustration Rare",
          "Hyper Rare",
          "ACE SPEC",
          "Secret Rare",
          "Promo",
          "Rare Holo",
          "Classic Collection",
          "Holo Rare VSTAR",
          "Holo Rare VMAX",
          "Radiant Rare",
          "Rare Holo LV.X",
          "Shiny Rare VMAX",
          "Black Star Promos",
          "Mega Hyper Rare",
          "Holo Rare V",
          "None",
          "Holo Rare",
          "Shiny Rare",
          "Shiny Rare V",
          "Full Art Trainer",
          "Amazing Rare",
          "Rare PRIME",
          "LEGEND",
          "ACE SPEC Rare",
          // Include common variations
          "common",
          "uncommon",
          "rare",
          "double rare",
          "ultra rare",
          "shiny ultra rare",
          "illustration rare",
          "special illustration rare",
          "hyper rare",
          "ace spec",
          "secret rare",
          "promo",
          "rare holo",
          "classic collection",
          "holo rare vstar",
          "holo rare vmax",
          "radiant rare",
          "rare holo lv.x",
          "shiny rare vmax",
          "black star promos",
          "mega hyper rare",
          "holo rare v",
          "none",
          "holo rare",
          "shiny rare",
          "shiny rare v",
          "full art trainer",
          "amazing rare",
          "rare prime",
          "legend",
          "ace spec rare",
        ];

        // STRICT: Block ANY card with invalid rarity
        if (card.rarity) {
          // Check for obviously digital patterns
          if (
            card.rarity.toLowerCase().includes("diamond") ||
            card.rarity.includes("Four") ||
            card.rarity.includes("Three") ||
            card.rarity.includes("Two") ||
            card.rarity.includes("One")
          ) {
            blockedCards.push({
              card,
              reason: `digital rarity pattern: ${card.rarity}`,
            });
            return false; // Block digital rarities
          }

          // Must be in valid list (case-insensitive)
          if (
            !validPhysicalRarities.some(
              (validRarity) =>
                validRarity.toLowerCase() === card.rarity.toLowerCase(),
            )
          ) {
            blockedCards.push({
              card,
              reason: `rarity not in valid list: ${card.rarity}`,
            });
            return false; // Block any rarity not in the official list
          }
        }

        // Keep physical cards
        console.log(`PASS: ${card.name} - passed all filters`);
        return true;
      });

      if (physicalCards.length === 0) {
        // No physical cards found
        allCards = [];
        document.getElementById("controls").style.display = "none";
        document.getElementById("pagination").style.display = "none";

        let cardContainer;
        if (document.getElementById("card-display-test")) {
          cardContainer = document.getElementById("card-display-test");
        } else if (document.getElementById("cards-search-results-list")) {
          cardContainer = document.getElementById("cards-search-results-list");
        } else {
          cardContainer = document.getElementById("card-display-test"); // fallback
        }
        cardContainer.innerHTML =
          "<p>No physical TCG cards found matching: " +
          pokemonCard +
          ". Only digital/video game cards were found.</p>";
        return;
      }

      // Store filtered physical cards globally for filtering/sorting/pagination
      allCards = physicalCards;

      console.log(`Total cards after filtering: ${physicalCards.length}`);
      console.log(`Blocked ${blockedCards.length} cards as digital`);

      // Populate set filter with unique sets from results
      populateSetFilter(allCards);

      // Reset to first page
      currentPage = 1;

      // Show controls
      document.getElementById("controls").style.display = "block";

      // Add price check button if not already there
      let priceCheckBtn = document.getElementById("removeSelectedBtn");
      if (!priceCheckBtn) {
        priceCheckBtn = document.createElement("button");
        priceCheckBtn.id = "removeSelectedBtn";
        priceCheckBtn.textContent = "Price Check Selected";
        priceCheckBtn.onclick = removeSelectedCards;
        priceCheckBtn.style.marginLeft = "20px";
        document.getElementById("controls").appendChild(priceCheckBtn);
      }

      // Apply current filters and display
      await applyFilters();

      // Log all found cards for debugging
      console.log(
        "Found physical cards:",
        physicalCards.map((c) => ({
          name: c.name || "Unknown",
          id: c.id || "Unknown",
          set: c.set?.name || "Unknown Set",
        })),
      );

      // Display blocked cards for debugging
      if (blockedCards.length > 0) {
        console.log("Blocked digital cards:", blockedCards);
        let debugContainer = document.getElementById("debug-blocked-cards");
        if (!debugContainer) {
          debugContainer = document.createElement("div");
          debugContainer.id = "debug-blocked-cards";
          debugContainer.style.border = "1px solid red";
          debugContainer.style.padding = "10px";
          debugContainer.style.marginTop = "20px";
          document.body.appendChild(debugContainer);
        }
        debugContainer.innerHTML =
          "<h3>Blocked Digital Cards (for debugging):</h3><ul>" +
          blockedCards
            .map(
              (b) =>
                `<li>${b.card.name} (${
                  b.card.set?.name || "Unknown Set"
                }) - Reason: ${b.reason}</li>`,
            )
            .join("") +
          "</ul>";
      }
    } else {
      // No cards found
      allCards = [];
      document.getElementById("controls").style.display = "none";
      document.getElementById("pagination").style.display = "none";

      let cardContainer;
      if (document.getElementById("card-display-test")) {
        cardContainer = document.getElementById("card-display-test");
      } else if (document.getElementById("cards-search-results-list")) {
        cardContainer = document.getElementById("cards-search-results-list");
      } else {
        cardContainer = document.getElementById("card-display-test"); // fallback
      }
      cardContainer.innerHTML =
        "<p>No cards found matching: " + pokemonCard + "</p>";
    }
  } catch (error) {
    console.error("Error searching cards:", error);
    alert("An error occurred while searching. Check the console for details.");
  }
}

// Function to apply sorting and filtering
async function applyFilters() {
  if (allCards.length === 0) return;

  const sortOrder = document.getElementById("sortOrder").value;
  const currencyFilter = document.getElementById("currencyFilter").value;
  const selectedSets = window.selectedSets || [];

  // Apply set filter first
  let filteredCards = allCards;
  if (selectedSets.length > 0) {
    filteredCards = allCards.filter((card) => {
      const setId = card.set?.id || card.id?.split("-")[0];
      const setName = card.set?.name || setsMap[setId] || setId;
      return selectedSets.includes(setName);
    });
  }

  // Fetch full card details for ALL filtered cards to get pricing
  const cardContainer = document.getElementById("card-display-test");
  cardContainer.innerHTML =
    "<p style='text-align: center;'>Loading card details...</p>";

  const fullCardPromises = filteredCards
    .filter((card) => card && card.id)
    .map((card) =>
      fetch(`https://api.tcgdex.net/v2/en/cards/${card.id}`)
        .then((response) => (response.ok ? response.json() : null))
        .catch((error) => {
          console.error(`Error fetching card ${card.id}:`, error);
          return null;
        }),
    );

  const fullCards = await Promise.all(fullCardPromises);
  const validFullCards = fullCards.filter((card) => card !== null);

  // Apply sorting to ALL cards if selected
  if (sortOrder !== "none") {
    validFullCards.sort((a, b) => {
      if (!a || !b) return 0;

      let priceA = 0;
      let priceB = 0;

      // Always prioritize USD pricing for sorting, fall back to EUR
      if (a.pricing?.tcgplayer?.holofoil?.marketPrice) {
        priceA = a.pricing.tcgplayer.holofoil.marketPrice;
      } else if (a.pricing?.cardmarket?.avg) {
        priceA = a.pricing.cardmarket.avg;
      }

      if (b.pricing?.tcgplayer?.holofoil?.marketPrice) {
        priceB = b.pricing.tcgplayer.holofoil.marketPrice;
      } else if (b.pricing?.cardmarket?.avg) {
        priceB = b.pricing.cardmarket.avg;
      }

      if (sortOrder === "high-to-low") {
        return priceB - priceA;
      } else {
        return priceA - priceB;
      }
    });

    // Log top 10 cards by price for debugging
    console.log("Top 10 cards by price:");
    validFullCards.slice(0, 10).forEach((card, idx) => {
      const usdPrice = card.pricing?.tcgplayer?.holofoil?.marketPrice || 0;
      const eurPrice = card.pricing?.cardmarket?.avg || 0;
      const sortPrice = usdPrice || eurPrice;
      console.log(
        `${idx + 1}. ${card.name} (${card.id}) - $${sortPrice.toFixed(2)}`,
      );
    });
  }

  // Paginate AFTER sorting all cards
  const startIndex = (currentPage - 1) * cardsPerPage;
  const endIndex = startIndex + cardsPerPage;
  const cardsToShow = validFullCards.slice(startIndex, endIndex);

  // Display the cards
  displayCards(cardsToShow, currencyFilter);

  // Update pagination with filtered count
  updatePagination(validFullCards.length);
}

// Function to display cards
function displayCards(cards, currencyFilter) {
  // Determine which container to use based on the page
  let cardContainer;
  if (document.getElementById("card-display-test")) {
    cardContainer = document.getElementById("card-display-test");
  } else if (document.getElementById("cards-search-results-list")) {
    cardContainer = document.getElementById("cards-search-results-list");
  } else {
    cardContainer = document.getElementById("card-display-test"); // fallback
  }

  cardContainer.innerHTML = "";

  cards.forEach((fullCard) => {
    if (!fullCard || !fullCard.name || !fullCard.image) return;

    // Create a container for each card
    const cardDiv = document.createElement("div");
    cardDiv.style.display = "inline-block";
    cardDiv.style.textAlign = "center";
    cardDiv.style.margin = "10px";
    cardDiv.style.verticalAlign = "top";

    // Create checkbox for removal
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = fullCard.id;
    checkbox.className = "card-checkbox";
    checkbox.style.display = "block";
    checkbox.style.margin = "0 auto 5px auto";

    // Create the card image
    const cardImg = document.createElement("img");
    cardImg.src = fullCard.image + "/high.webp";
    cardImg.alt = fullCard.name;
    cardImg.style.width = "200px";
    cardImg.style.display = "block";
    cardImg.style.margin = "0 auto 5px auto";

    // Create card name
    const cardName = document.createElement("div");
    cardName.textContent = fullCard.name;
    cardName.style.fontSize = "14px";
    cardName.style.fontWeight = "bold";
    cardName.style.marginBottom = "5px";

    // Create pricing info
    const pricingDiv = document.createElement("div");
    pricingDiv.style.fontSize = "12px";
    pricingDiv.style.color = "#666";

    let pricingText = "Price: N/A";

    if (fullCard.pricing) {
      const prices = [];

      // TCGPlayer pricing (USD)
      if (
        (currencyFilter === "usd" || currencyFilter === "both") &&
        fullCard.pricing.tcgplayer &&
        fullCard.pricing.tcgplayer.holofoil
      ) {
        const usdPrice = fullCard.pricing.tcgplayer.holofoil.marketPrice;
        if (usdPrice) {
          prices.push(`$${usdPrice.toFixed(2)} USD`);
        }
      }

      // Cardmarket pricing (EUR)
      if (
        (currencyFilter === "eur" || currencyFilter === "both") &&
        fullCard.pricing.cardmarket
      ) {
        const eurPrice = fullCard.pricing.cardmarket.avg;
        if (eurPrice) {
          prices.push(`€${eurPrice.toFixed(2)} EUR`);
        }
      }

      if (prices.length > 0) {
        pricingText = "Price: " + prices.join(" | ");
      }
    }

    pricingDiv.textContent = pricingText;

    // Add click event to show more details
    cardDiv.onclick = () => {
      console.log("Card details:", fullCard);
      alert(
        `${fullCard.name}\nSet: ${fullCard.set.name}\nRarity: ${
          fullCard.rarity || "N/A"
        }\n${pricingText}`,
      );
    };

    // Assemble the card display
    cardDiv.appendChild(checkbox);
    cardDiv.appendChild(cardImg);
    cardDiv.appendChild(cardName);
    cardDiv.appendChild(pricingDiv);

    // Add the card to the container
    cardContainer.appendChild(cardDiv);
  });
}

// Function to update pagination controls
function updatePagination(totalCount) {
  const totalPages = Math.ceil(totalCount / cardsPerPage);
  const paginationDiv = document.getElementById("pagination");
  const pageInfo = document.getElementById("pageInfo");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (totalPages > 1) {
    paginationDiv.style.display = "block";
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
  } else {
    paginationDiv.style.display = "none";
  }
}

// Function to change page
function changePage(direction) {
  const totalPages = Math.ceil(allCards.length / cardsPerPage);
  currentPage += direction;

  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;

  applyFilters();
}

// Function to remove selected cards
function removeSelectedCards() {
  const checkboxes = document.querySelectorAll(".card-checkbox:checked");
  const idsToCheck = Array.from(checkboxes).map((cb) => cb.value);

  if (idsToCheck.length === 0) {
    alert("No cards selected for price check.");
    return;
  }

  // Fetch full card details for price checking
  const priceCheckPromises = idsToCheck.map((id) =>
    fetch(`https://api.tcgdex.net/v2/en/cards/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .catch((error) => {
        console.error(`Error fetching card ${id}:`, error);
        return null;
      }),
  );

  Promise.all(priceCheckPromises).then((cards) => {
    const priceInfo = cards
      .filter((card) => card !== null)
      .map((card) => {
        const usdPrice = card.pricing?.tcgplayer?.holofoil?.marketPrice || 0;
        const eurPrice = card.pricing?.cardmarket?.avg || 0;
        const sortPrice = usdPrice || eurPrice;

        return {
          name: card.name,
          id: card.id,
          usdPrice,
          eurPrice,
          sortPrice,
          pricing: card.pricing,
        };
      })
      .sort((a, b) => b.sortPrice - a.sortPrice);

    // Log to console with full details
    console.log("=== PRICE CHECK RESULTS ===");
    priceInfo.forEach((info) => {
      console.log(
        `${info.name} (${info.id}):\n` +
          `  USD: $${info.usdPrice.toFixed(2)}\n` +
          `  EUR: €${info.eurPrice.toFixed(2)}\n` +
          `  Sort Price: $${info.sortPrice.toFixed(2)}\n` +
          `  Full Pricing:`,
        info.pricing,
      );
    });

    // Create summary for alert
    const summary = priceInfo
      .map(
        (info) =>
          `${info.name}\n  USD: $${info.usdPrice.toFixed(2)} | EUR: €${info.eurPrice.toFixed(2)}\n  Sort: $${info.sortPrice.toFixed(2)}`,
      )
      .join("\n\n");

    alert(
      `PRICE CHECK (${idsToCheck.length} cards)\n\n${summary}\n\n✓ Check console for full pricing details`,
    );
  });
}

// Function to load default cards on page load
async function loadDefaultCards() {
  // Default to searching for popular/valuable cards
  document.getElementById("pokemonCard").value = "charizard";
  // Perform the search
  await searchCards();
}

// Function to load default cards on page load (show popular cards)
async function loadDefaultCards() {
  // Set a default search term for popular cards
  document.getElementById("pokemonCard").value = "charizard";
  // Perform the search
  await searchCards();
}

// Load default cards when the page loads
window.addEventListener("load", async () => {
  await loadSetsData();
  loadDefaultCards();
});

// Function to populate the set filter dropdown
function populateSetFilter(cards) {
  const dropdown = document.getElementById("setDropdown");
  dropdown.innerHTML = "";

  console.log("Populating set filter with", cards.length, "cards");

  // Get unique sets
  const uniqueSets = [
    ...new Set(
      cards
        .map((card) => {
          console.log(
            "Full card set data:",
            card.name,
            card.set,
            "ID:",
            card.id,
          );
          // Try set.name, set.id, or extract from card.id and map to name
          const setId = card.set?.id || card.id?.split("-")[0];
          return card.set?.name || setsMap[setId] || setId;
        })
        .filter((name) => name),
    ),
  ].sort();

  console.log("Unique sets:", uniqueSets);

  if (uniqueSets.length === 0) {
    const noSetsMsg = document.createElement("div");
    noSetsMsg.textContent = "No sets available for filtering";
    noSetsMsg.style.padding = "10px";
    dropdown.appendChild(noSetsMsg);
    return;
  }

  // Add Check All / Clear All buttons
  const buttonsDiv = document.createElement("div");
  buttonsDiv.className = "buttons";
  buttonsDiv.style.marginBottom = "10px";

  const checkAllBtn = document.createElement("button");
  checkAllBtn.textContent = "Check All";
  checkAllBtn.onclick = () => {
    const checkboxes = dropdown.querySelectorAll(".set-checkbox");
    checkboxes.forEach((cb) => (cb.checked = true));
  };

  const clearAllBtn = document.createElement("button");
  clearAllBtn.textContent = "Clear All";
  clearAllBtn.onclick = () => {
    const checkboxes = dropdown.querySelectorAll(".set-checkbox");
    checkboxes.forEach((cb) => (cb.checked = false));
  };

  buttonsDiv.appendChild(checkAllBtn);
  buttonsDiv.appendChild(clearAllBtn);
  dropdown.appendChild(buttonsDiv);

  // Add checkboxes for each set
  uniqueSets.forEach((setName) => {
    const label = document.createElement("label");
    label.style.display = "block";
    label.style.margin = "2px 0";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = setName;
    checkbox.className = "set-checkbox";

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${setName}`));
    dropdown.appendChild(label);
  });

  // Add apply button
  const applyBtn = document.createElement("button");
  applyBtn.textContent = "Apply Filter";
  applyBtn.onclick = applySetFilter;
  applyBtn.style.margin = "10px";
  dropdown.appendChild(applyBtn);
}

// Function to apply set filter
function applySetFilter() {
  const checkboxes = document.querySelectorAll(".set-checkbox:checked");
  window.selectedSets = Array.from(checkboxes).map((cb) => cb.value);
  console.log("Applied set filter:", window.selectedSets);
  currentPage = 1; // Reset to first page
  applyFilters();
}

// Function to update cards per page
function updateCardsPerPage() {
  const select = document.getElementById("cardsPerPage");
  cardsPerPage = parseInt(select.value);
  currentPage = 1; // Reset to first page
  applyFilters();
}

// Function to toggle dropdown visibility
function toggleDropdown() {
  const dropdown = document.getElementById("setDropdown");
  dropdown.style.display =
    dropdown.style.display === "block" ? "none" : "block";
}

// Function to load sets data
async function loadSetsData() {
  try {
    const sets = await tcgdex.fetch("sets");
    setsMap = {};
    sets.forEach((set) => {
      setsMap[set.id] = set.name;
    });
    console.log("Loaded sets map:", setsMap);
  } catch (error) {
    console.error("Error loading sets data:", error);
  }
}

// Function to load default cards on page load (show popular cards)
async function loadDefaultCards() {
  // Leave search empty to show broader results
  document.getElementById("pokemonCard").value = "";
  // Perform the search
  await searchCards();
}

// Load default cards when the page loads
window.addEventListener("load", async () => {
  await loadSetsData();
  loadDefaultCards();
});

// Make the functions globally available (since onclick uses them)
window.searchCards = searchCards;
window.applyFilters = applyFilters;
window.changePage = changePage;
window.removeSelectedCards = removeSelectedCards;
window.toggleDropdown = toggleDropdown;
window.applySetFilter = applySetFilter;
window.updateCardsPerPage = updateCardsPerPage;
