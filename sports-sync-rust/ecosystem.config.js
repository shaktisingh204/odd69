module.exports = {
    apps: [
        {
            name: "sports-sync-rust",
            script: "./target/release/sports-sync-rust",
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "500M",
            // Run only on the writer host so we don't double-poll upstream.
            // Reader VPSes should not run this process.
            env: {
                NODE_ENV: "production",
                RUST_LOG: "info,sports_sync_rust=info",
            },
        },
    ],
};
