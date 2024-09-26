import './sourcemap-register.cjs';/******/ /* webpack/runtime/compat */
/******/ 
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = new URL('.', import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

var __createBinding = (undefined && undefined.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (undefined && undefined.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (undefined && undefined.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const core = __importStar(require("@actions/core"));
const run_1 = require("./utils/run");
const spacectl_1 = require("./commands/spacectl");
// Define the main function correctly
const main = async () => {
    try {
        const binaryFolder = await (0, spacectl_1.installAndGetFolder)();
        core.addPath(binaryFolder);
        core.info("Added spacectl to PATH: " + binaryFolder);
        await (0, run_1.run)({
            command: core.getInput('command', { required: true }),
            region: core.getInput('region', { required: true }),
            env: core.getInput('env', { required: true }),
            integration_name: core.getInput('integration_name', { required: true }),
            service_name: core.getInput('service_name', { required: true }),
            label_prefix: core.getInput('label_prefix', { required: true }),
            label_postfix: core.getInput('label_postfix', { required: true }),
        });
    }
    catch (e) {
        core.setFailed(e.message);
        console.error(e);
    }
};
exports.main = main;
// Ensure proper handling of errors in the async context
main().catch((e) => {
    core.setFailed(e.message);
    console.error(e);
});


//# sourceMappingURL=index.js.map