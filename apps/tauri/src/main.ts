import { invoke } from "@tauri-apps/api/core";

async function run() {
  const res = await invoke<string>("test_core");
  console.log(res);
}

run();
