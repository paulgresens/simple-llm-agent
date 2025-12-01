const fs = require("fs");
const StreamArray = require("stream-json/streamers/StreamArray");
const { Writable } = require("stream");
const { formatWithOptions } = require("util");

// --- CONFIGURATION ---
const INPUT_FILE = "final_all_select1000.json";
const OUTPUT_FILE = "final1000.jsonl";
// ---------------------

const readStream = fs.createReadStream(INPUT_FILE);
const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: "w" });
const jsonStream = StreamArray.withParser();

count = 0;

const processingStream = new Writable({
  objectMode: true,
  write({ key, value }, encoding, callback) {
    const line = JSON.stringify(value) + "\n";
    writeStream.write(line);

    console.log(value.doi);
    count++;
    // Ready for the next item
    callback();
  },
});
readStream
  .pipe(jsonStream)
  .pipe(processingStream)
  .on("finish", () => {
    console.log("Done! File processed successfully.");
    console.log("COUNT: " + count);
  })
  .on("error", (err) => console.error("Error:", err));
