import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import { dts } from "rollup-plugin-dts";

const external = [
  "@xmtp/content-type-primitives",
  "@xmtp/content-type-text",
  "@xmtp/grpc-api-client",
  "@xmtp/mls-client",
  "@xmtp/proto",
  "@xmtp/content-type-reaction",
  "@xmtp/content-type-reply",
  "@xmtp/xmtp-js",
  "viem",
  "viem/accounts",
  "viem/chains",
  "dotenv",
  "ethers",
];

const plugins = [
  typescript({
    declaration: false,
    declarationMap: false,
  }),
];

export default defineConfig([
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "es",
      sourcemap: true,
    },
    plugins,
    external,
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: true,
    },
    plugins,
    external,
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "es",
    },
    plugins: [dts()],
  },
]);
