module.exports.up = async ({ connection }) => {
  await connection.query(`CREATE TABLE IF NOT EXISTS worker_health (
    name VARCHAR(80) PRIMARY KEY, heartbeat_at DATETIME NOT NULL
  ) ENGINE=InnoDB`);
  await connection.query("ALTER TABLE outbox_events MODIFY status ENUM('pending','processing','delivered','failed','skipped') NOT NULL DEFAULT 'pending'");
};
