const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const session = require("express-session");
const app = express();
const PORT = process.env.PORT || 3000;
const crypto = require("crypto");
require("dotenv").config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
      },
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }, // Set secure: true in production with HTTPS
  })
);

// ✅ STATIC FILES MUST BE HERE (BEFORE ROUTES)
app.use(express.static(path.join(__dirname)));
app.use("/CSS", express.static(path.join(__dirname, "CSS")));
app.use("/HTML", express.static(path.join(__dirname, "HTML")));
app.use("/JavaScript", express.static(path.join(__dirname, "JavaScript")));
app.use("/pictures", express.static(path.join(__dirname, "pictures")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// ✅ THEN YOUR ROUTES COME AFTER
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (validPassword) {
      req.session.userId = user.id;
      req.session.username = user.username;

      res.json({
        success: true,
        message: "Login successful",
        username: user.username,
      });
    } else {
      res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/config", (req, res) => {
  res.json({
    rapidApiKey: process.env.RAPIDAPI_KEY,
    rapidApiHost: process.env.RAPIDAPI_HOST,
  });
});

app.get("/api/user", (req, res) => {
  if (req.session.userId) {
    res.json({ success: true, username: req.session.username });
  } else {
    res.status(401).json({ success: false, message: "Not logged in" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: "Logout successful" });
});

// Signup endpoint
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }

  try {
    // hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // insert user into database
    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email, password_hash],
    );

    res.json({
      success: true,
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Signup error:", error);
    if (error.code === "23505") {
      // unique_violation
      res
        .status(400)
        .json({ success: false, message: "Username or email already exists" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
});

// Generate shareable wishlist link
app.post("/api/wishlist/share", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  try {
    const shareToken = crypto.randomBytes(16).toString("hex");

    pool.query(
      "INSERT INTO wishlist_shares (user_id, share_token) VALUES ($1, $2) RETURNING share_token",
      [req.session.userId, shareToken],
      (error, result) => {
        if (error) {
          console.error("Share error:", error);
          return res
            .status(500)
            .json({ success: false, message: "Error creating share link" });
        }

        const baseUrl = process.env.APP_URL || "http://localhost:3000";
        const shareUrl = `${baseUrl}/HTML/TCG-Shared-Wishlist.html?share=${shareToken}`;
        res.json({ success: true, shareUrl });
      },
    );
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get shared wishlist (no login required)
app.get("/api/wishlist/shared/:token", (req, res) => {
  const { token } = req.params;

  try {
    pool.query(
      `SELECT u.username, u.id, ws.created_at 
       FROM wishlist_shares ws
       JOIN users u ON ws.user_id = u.id
       WHERE ws.share_token = $1`,
      [token],
      (error, result) => {
        if (error || result.rows.length === 0) {
          return res
            .status(404)
            .json({ success: false, message: "Share link not found" });
        }

        const owner = result.rows[0];

        // Get their wishlist items
        pool.query(
          `SELECT w.* FROM wishlist w WHERE w.user_id = $1 ORDER BY w.priority DESC`,
          [owner.id],
          (err, wishlistResult) => {
            if (err) {
              return res
                .status(500)
                .json({ success: false, message: "Error fetching wishlist" });
            }

            res.json({
              success: true,
              owner: { username: owner.username, id: owner.id },
              wishlist: wishlistResult.rows,
            });
          },
        );
      },
    );
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Compare wishlists
app.post("/api/wishlist/compare", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  const { shareToken } = req.body;

  try {
    pool.query(
      `SELECT u.id FROM wishlist_shares ws
       JOIN users u ON ws.user_id = u.id
       WHERE ws.share_token = $1`,
      [shareToken],
      (error, result) => {
        if (error || result.rows.length === 0) {
          return res
            .status(404)
            .json({ success: false, message: "Share link not found" });
        }

        const friendId = result.rows[0].id;

        pool.query(
          "SELECT username FROM users WHERE id = $1",
          [friendId],
          (err0, userResult) => {
            if (err0 || !userResult.rows[0]) {
              return res.status(500).json({ success: false });
            }

            const friendUsername = userResult.rows[0].username;

            // ✅ ADD imagelarge, imagesmall, setname, number columns
            pool.query(
              "SELECT id, name, imagelarge, imagesmall, setname, number FROM wishlist WHERE user_id = $1",
              [req.session.userId],
              (err1, myWishlist) => {
                if (err1) {
                  console.error("Error:", err1);
                  return res.status(500).json({ success: false });
                }

                // ✅ ADD imagelarge, imagesmall, setname, number columns
                pool.query(
                  "SELECT id, name, imagelarge, imagesmall, setname, number FROM wishlist WHERE user_id = $1",
                  [friendId],
                  (err2, friendWishlist) => {
                    if (err2) {
                      console.error("Error:", err2);
                      return res.status(500).json({ success: false });
                    }

                    const myCardIds = new Set(myWishlist.rows.map((r) => r.id));
                    const friendCardIds = new Set(
                      friendWishlist.rows.map((r) => r.id),
                    );

                    const matchingCount = [...myCardIds].filter((id) =>
                      friendCardIds.has(id),
                    ).length;
                    const onlyYouHave = [...myCardIds].filter(
                      (id) => !friendCardIds.has(id),
                    ).length;
                    const onlyTheyHave = [...friendCardIds].filter(
                      (id) => !myCardIds.has(id),
                    ).length;

                    res.json({
                      success: true,
                      comparison: {
                        matchingCount,
                        onlyYouHave,
                        onlyTheyHave,
                        friendUsername,
                        myCards: myWishlist.rows, // ✅ NOW HAS IMAGES
                        friendCards: friendWishlist.rows, // ✅ NOW HAS IMAGES
                      },
                    });
                  },
                );
              },
            );
          },
        );
      },
    );
  } catch (error) {
    console.error("Compare error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get user's wishlist
app.get("/api/wishlist", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  pool.query(
    "SELECT * FROM wishlist WHERE user_id = $1 ORDER BY priority DESC, created_at DESC",
    [req.session.userId],
    (error, result) => {
      if (error) {
        console.error("Error fetching wishlist:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
      res.json({ success: true, wishlist: result.rows });
    },
  );
});

// Add card to wishlist
app.post("/api/wishlist", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  const {
    card_id,
    name,
    setName,
    number,
    rarity,
    imageLarge,
    imageSmall,
    priority,
    price,
    selectedGrade,
    gradedPrices,
  } = req.body;

  // Validate required fields
  if (!card_id || !name) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: card_id and name",
    });
  }

  // Ensure gradedPrices is a valid JSON string
  let gradedPricesJson = "{}";
  if (gradedPrices) {
    try {
      if (typeof gradedPrices === "string") {
        gradedPricesJson = gradedPrices;
      } else {
        gradedPricesJson = JSON.stringify(gradedPrices);
      }
    } catch (e) {
      console.warn("Could not parse gradedPrices:", e);
      gradedPricesJson = "{}";
    }
  }

  console.log("Adding to wishlist:", {
    userId: req.session.userId,
    card_id,
    name,
    setName,
    price,
    gradedPricesJson,
  });

  // Use lowercase column names (matching your actual database schema)
  pool.query(
    `INSERT INTO wishlist (user_id, card_id, name, setname, number, rarity, imagelarge, imagesmall, priority, price, selectedgrade, gradedprices)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (user_id, card_id) DO UPDATE SET priority = $9, price = $10, selectedgrade = $11, gradedprices = $12
     RETURNING *`,
    [
      req.session.userId,
      card_id,
      name,
      setName || "Unknown",
      number || "",
      rarity || "Unknown",
      imageLarge || "",
      imageSmall || "",
      priority || "medium",
      parseFloat(price) || 0,
      selectedGrade || "raw",
      gradedPricesJson,
    ],
    (error, result) => {
      if (error) {
        console.error("Error adding to wishlist:", error);
        console.error("Error details:", {
          code: error.code,
          message: error.message,
          detail: error.detail,
        });
        return res.status(500).json({
          success: false,
          message: error.message,
          detail: error.detail,
        });
      }
      console.log("Successfully added to wishlist:", result.rows[0]);
      res.json({ success: true, item: result.rows[0] });
    },
  );
});

// Remove from wishlist
app.delete("/api/wishlist/:id", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  pool.query(
    "DELETE FROM wishlist WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.session.userId],
    (error, result) => {
      if (error) {
        console.error("Error deleting from wishlist:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
      res.json({ success: true });
    },
  );
});

// Update wishlist item priority
app.put("/api/wishlist/:id", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  const { priority, selectedGrade, gradedPrices } = req.body;

  let gradedPricesJson = null;
  if (gradedPrices !== undefined) {
    try {
      gradedPricesJson =
        typeof gradedPrices === "string"
          ? gradedPrices
          : JSON.stringify(gradedPrices);
    } catch (e) {
      gradedPricesJson = "{}";
    }
  }

  pool.query(
    `UPDATE wishlist
     SET priority = COALESCE($1, priority),
         selectedgrade = COALESCE($2, selectedgrade),
         gradedprices = COALESCE($3, gradedprices)
     WHERE id = $4 AND user_id = $5
     RETURNING *`,
    [
      priority,
      selectedGrade,
      gradedPricesJson,
      req.params.id,
      req.session.userId,
    ],
    (error, result) => {
      if (error) {
        console.error("Error updating wishlist item:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
      res.json({ success: true, item: result.rows[0] });
    },
  );
});

// Get budget limit
app.get("/api/budget/limit", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  pool.query(
    "SELECT limit_amount FROM budget_limits WHERE user_id = $1",
    [req.session.userId],
    (error, result) => {
      if (error) {
        console.error("Error fetching budget limit:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
      const limit = result.rows.length > 0 ? result.rows[0].limit_amount : 0;
      res.json({ success: true, limit: limit });
    },
  );
});

// Set budget limit
app.post("/api/budget/limit", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  const { limit } = req.body;

  pool.query(
    `INSERT INTO budget_limits (user_id, limit_amount, updated_at) 
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET limit_amount = $2, updated_at = CURRENT_TIMESTAMP
     RETURNING limit_amount`,
    [req.session.userId, limit || 0],
    (error, result) => {
      if (error) {
        console.error("Error setting budget limit:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
      res.json({ success: true, limit: result.rows[0].limit_amount });
    },
  );
});

// Add to budget
app.post("/api/budget", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  const {
    card_id,
    name,
    imageSmall,
    imageLarge,
    setName,
    setId,
    number,
    rarity,
    selectedGrade,
    prices,
  } = req.body;

  pool.query(
    `INSERT INTO budget (user_id, card_id, name, imageSmall, imageLarge, setName, setId, number, rarity, selectedGrade, prices)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id, card_id) DO UPDATE SET selectedGrade = $10, prices = $11
     RETURNING *`,
    [
      req.session.userId,
      card_id,
      name,
      imageSmall,
      imageLarge,
      setName,
      setId,
      number,
      rarity,
      selectedGrade || "raw",
      JSON.stringify(
        prices || { raw: 0, psa9: 0, psa10: 0, beckett9: 0, beckett10: 0 },
      ),
    ],
    (error, result) => {
      if (error) {
        console.error("Error adding to budget:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
      res.json({ success: true, item: result.rows[0] });
    },
  );
});

// Update budget item
app.put("/api/budget/:id", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  const { purchased, inBudget, selectedGrade, prices } = req.body;

  pool.query(
    `UPDATE budget 
     SET purchased = COALESCE($1, purchased), 
         inBudget = COALESCE($2, inBudget),
         selectedGrade = COALESCE($3, selectedGrade),
         prices = COALESCE($4, prices)
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [
      purchased,
      inBudget,
      selectedGrade,
      prices ? JSON.stringify(prices) : null,
      req.params.id,
      req.session.userId,
    ],
    (error, result) => {
      if (error) {
        console.error("Error updating budget:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
      }
      res.json({ success: true, item: result.rows[0] });
    },
  );
});

// Remove from budget
app.delete("/api/budget/:id", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  pool.query(
    "DELETE FROM budget WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.session.userId],
    (error, result) => {
      if (error) {
        console.error("Error removing from budget:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
      }
      res.json({ success: true, message: "Item removed" });
    },
  );
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
