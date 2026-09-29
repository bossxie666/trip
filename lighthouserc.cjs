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
        throttlingMethod: "simulate",
        formFactor: "mobile",
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.65 }],
        "first-contentful-paint": ["error", { maxNumericValue: 3000 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 4000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { maxNumericValue: 500 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci/reports" },
  },
};
