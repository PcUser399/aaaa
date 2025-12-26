const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const maxmind = require("maxmind");
const path = require("path");
const app = express();


const cityLookup = maxmind.openSync(path.join(__dirname, "GeoLite2-City.mmdb"));
const corsOptions = {
  origin: "*", // allow all origins for testing
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));

app.use(express.json());
app.set("trust proxy", true);
console.log("Platform:", process.platform);

const cppFile =
  process.platform === "win32"
    ? path.join(__dirname, "main.exe")
    : path.join(__dirname, "main");

// Initial check
let month = new Date().getMonth();
sendDataToCppAndReceiveItAfterCppOperation(cppFile, {
  command: "check new month",
  info: String(month),
  object: {},
}); // rajaaha kima kenet !!!!!!!!


app.get("/get-ip", async (req, res) => {
  try{
    const ip = req.ip ;
    const geo = cityLookup.get(ip);

    const city = geo?.city?.names?.en || "Unknown";
    const country = geo?.country?.names?.en || "Unknown";

    console.log("Log In detected User Ip Adress : "+ip);
    console.log("User Contry : "+country);
    console.log("User city : "+city);}
  catch(err){
    console.log("GeoIP Error : ",err);
  }
});


app.post("/submit", (req, res) => {
  sendDataToCppAndReceiveItAfterCppOperation(cppFile, req.body, res);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on http://localhost:" + PORT);
});

function sendDataToCppAndReceiveItAfterCppOperation(cppPath, data, res) {
  const cpp = spawn(cppPath, [], { stdio: ["pipe", "pipe", "pipe"] });
  let finished = false;
  let output = "";

  const timeout = setTimeout(() => {
    if (!finished) {
      cpp.kill();
      finished = true;
      console.log("C++ TimeOut Error");
      if (res) res.status(504).json({ error: "C++ timeout" });
    }
  }, 10000);

  cpp.stdout.on("data", (data) => (output += data.toString()));
  cpp.stderr.on("data", (data) => console.log(`C++ stderr: ${data}`));

  cpp.stdin.on("error", (err) => {
    console.error("C++ stdin error:", err);
  });

  cpp.on("close", (code) => {
    finished = true;
    clearTimeout(timeout);
    console.log(`C++ exited with code ${code}`);
    if (res) res.json({ result: output.trim() });
  });

  // Only write stdin if process is still alive
  if (!cpp.stdin.destroyed) {
    try {
      cpp.stdin.write(JSON.stringify(data) + "\n");
      cpp.stdin.end();
    } catch (err) {
      console.error("Write to C++ stdin failed:", err);
      if (!finished && res)
        res.status(500).json({ error: "Failed to write to C++" });
    }
  }
}
