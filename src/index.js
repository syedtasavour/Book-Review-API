import { app } from "./app.js";
import connectDb from "./db/index.js";

connectDb()
  .then(() => {
    app.on("error", (error) => {
      console.log("error", error);
      throw error;
    });
    app.listen(process.env.PORT || 3000, () => {});
    console.log(`Server is running on port : ${process.env.PORT}`);
  })
  .catch((err) => {
    console.log("MONGO DB connection failed !!!", err);
  });