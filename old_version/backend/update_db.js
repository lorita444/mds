const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');
db.run("ALTER TABLE materials ADD COLUMN summary TEXT", () => {
    db.run("ALTER TABLE materials ADD COLUMN study_time TEXT", () => {
        console.log("DB Updated");
    });
});
