module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["boundaries"],
  extends: ["plugin:boundaries/strict"],
  settings: {
    "boundaries/elements": [
      { type: "kernel", pattern: "src/production/kernel/**/*" },
      { type: "runtime", pattern: "src/production/runtime/**/*" },
      { type: "workflow", pattern: "src/production/workflow/**/*" },
      { type: "scheduler", pattern: "src/production/scheduler/**/*" },
      { type: "observability", pattern: "src/production/observability/**/*" },
      { type: "reliability", pattern: "src/production/reliability/**/*" },
      { type: "planning", pattern: "src/production/planning/**/*" },
      { type: "execution", pattern: "src/production/execution/**/*" },
      { type: "knowledge", pattern: "src/production/knowledge/**/*" },
      { type: "memory", pattern: "src/production/memory/**/*" },
      { type: "learning", pattern: "src/production/learning/**/*" },
      { type: "evolution", pattern: "src/production/evolution/**/*" },
      { type: "reasoning", pattern: "src/production/reasoning/**/*" },
      { type: "delivery", pattern: "src/production/delivery/**/*" },
      { type: "artifact", pattern: "src/production/artifact/**/*" },
      { type: "contracts", pattern: "src/production/contracts/**/*" }
    ]
  },
  rules: {
    "boundaries/element-types": [
      "error",
      {
        default: "disallow",
        rules: [
          { from: "observability", allow: ["runtime", "contracts"] },
          { from: "reliability", allow: ["runtime", "contracts"] },
          { from: "artifact", allow: ["runtime", "contracts", "observability"] },
          { from: "knowledge", allow: ["runtime", "contracts", "artifact"] },
          { from: "memory", allow: ["runtime", "contracts", "artifact", "knowledge"] },
          { from: "workflow", allow: ["runtime", "contracts", "observability", "reliability", "scheduler", "artifact"] },
          { from: "scheduler", allow: ["runtime", "contracts", "observability", "reliability", "workflow", "artifact"] },
          { from: "planning", allow: ["runtime", "contracts", "artifact", "memory"] },
          { from: "execution", allow: ["runtime", "contracts", "artifact", "memory"] },
          { from: "learning", allow: ["runtime", "knowledge", "contracts", "artifact", "memory"] },
          { from: "evolution", allow: ["runtime", "learning", "contracts", "artifact"] },
          { from: "reasoning", allow: ["runtime", "learning", "evolution", "contracts", "artifact", "memory"] },
          { from: "delivery", allow: ["runtime", "contracts", "artifact"] },
          { from: "runtime", allow: ["contracts", "artifact"] },
          { from: "kernel", allow: ["runtime", "observability", "reliability", "workflow", "scheduler", "artifact", "planning", "execution", "knowledge", "memory", "learning", "evolution", "reasoning", "delivery", "contracts"] }
        ]
      }
    ]
  }
};
