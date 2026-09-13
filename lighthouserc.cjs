module.exports = {
  ci: {
    collect: {
      startServerCommand: "npx wrangler dev --local --port 8787",
      startServerReadyPattern: "Ready on|http://localhost:8787",
      url: [
        "http://127.0.0.1:8787/",
        "http://127.0.0.1:8787/trips",
        "http://127.0.0.1:8787/trips/shanghai-hangzhou-2026/plan?view=planning",
        "http://127.0.0.1:8787/trips/shanghai-hangzhou-2026/plan?view=budget",
      ],
      numberOfRuns: 2,
      puppeteerScript: "./scripts/lighthouse-login.cjs",
      settings: {
        preset: "desktop",
        throttlingMethod: "simulate",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.5 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 3000 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 4000 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.15 }],
        "total-blocking-time": ["warn", { maxNumericValue: 600 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci/reports" },
  },
};
