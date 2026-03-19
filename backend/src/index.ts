import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
