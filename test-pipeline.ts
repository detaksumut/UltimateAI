import { RouterManager } from './src/infrastructure/gateway/routerManager';
import { GoalAnalyzer } from './src/intelligence/goal/analyzer';
import { IntentParser } from './src/intelligence/intent/parser';
import { ContextEngine } from './src/intelligence/context/engine';
import { ReasoningEngine } from './src/intelligence/reasoning/engine';
import { BlueprintDesigner } from './src/intelligence/blueprint/designer';
import { FeatureExtractor } from './src/intelligence/features/extractor';
import { GenerationEngine } from './src/production/generation/engine';
import { DeliveryService } from './src/production/delivery/service';

async function runTest() {
    console.log("=========================================");
    console.log("🚀 ULTIMATE AI - PIPELINE TEST RUN 🚀");
    console.log("=========================================\n");

    const userInput = "Buat aplikasi survei kemiskinan di Kota Medan, harus bisa offline dan ada petanya.";
    console.log(`👤 USER INPUT: "${userInput}"\n`);

    // 1. Initialize Gateway
    const router = new RouterManager();

    // 2. Initialize Engines
    const goalAnalyzer = new GoalAnalyzer(router);
    const intentParser = new IntentParser(router);
    const contextEngine = new ContextEngine(router);
    const reasoningEngine = new ReasoningEngine(router);
    const blueprintDesigner = new BlueprintDesigner(router);
    const featureExtractor = new FeatureExtractor(router);
    const generationEngine = new GenerationEngine(router);
    const deliveryService = new DeliveryService(router);

    try {
        console.log("🧠 --- INTELLIGENCE WORLD ---");
        // Goal
        const goal = await goalAnalyzer.analyze(userInput);
        console.log(`\n🎯 GOAL EXTRACTED: \${goal.primaryObjective}`);

        // Intent
        const intent = await intentParser.deriveIntent(goal);
        console.log(`\n⚡ INTENT PARSED: \${intent.action}`);

        // Context
        const context = await contextEngine.analyze(intent);
        console.log(`\n🌍 CONTEXT EXTRACTED: Tags = \${context.domainTags.join(', ')}`);

        // Reasoning
        const reasoning = await reasoningEngine.reason(intent, context, { nodes: [], edges: [] });
        console.log(`\n🤔 REASONING SYNTHESIS: \${reasoning.synthesis}`);

        // Blueprint
        const requirementDummy: any = {}; 
        const blueprint = await blueprintDesigner.designProduct(requirementDummy);
        console.log(`\n📐 BLUEPRINT DESIGNED: ID = \${blueprint.id}`);

        // Features
        const features = await featureExtractor.extractFeatures(blueprint);
        console.log(`\n⚙️ FEATURES EXTRACTED for Blueprint \${features.blueprintId}\n`);

        console.log("🏭 --- PRODUCTION WORLD ---");
        // Generation
        const asset = await generationEngine.generate(blueprint, 'SOFTWARE_APK');
        console.log(`\n📦 ASSET GENERATED: Type = \${asset.type}, Provider = \${asset.metadata.providerUsed}`);

        // Delivery
        const delivery = await deliveryService.deliver(asset, 'DIRECT_DOWNLOAD');
        console.log(`\n🚚 ASSET DELIVERED: Method = \${delivery.method}, URL = \${delivery.accessUrl}\n`);

        console.log("✅ TEST COMPLETED SUCCESSFULLY.");
    } catch (error) {
        console.error("❌ Pipeline failed:", error);
    }
}

runTest();
