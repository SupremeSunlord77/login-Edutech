import "dotenv/config";
import app from './app';

console.log("JWT_ACCESS_SECRET:", process.env.JWT_ACCESS_SECRET);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});