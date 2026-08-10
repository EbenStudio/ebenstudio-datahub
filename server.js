import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

const ORDER_API_URL =
  "https://adoefozylowntdjktpkk.supabase.co/functions/v1/orders";

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Ebenstudio Data Hub is running"
  });
});

// Create data order
app.post("/api/orders", async (req, res) => {
  try {
    const { phone_number, network, plan_size_gb, reference } = req.body;

    if (!phone_number || !network || !plan_size_gb) {
      return res.status(400).json({
        success: false,
        message: "Phone number, network and data size are required."
      });
    }

    if (!process.env.RAXAMART_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Order API key is not configured."
      });
    }

    const response = await fetch(ORDER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.RAXAMART_API_KEY
      },
      body: JSON.stringify({
        phone_number,
        network,
        plan_size_gb,
        reference
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);

  } catch (error) {
    console.error("Order error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to process the order."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Ebenstudio Data Hub running on port ${PORT}`);
});
