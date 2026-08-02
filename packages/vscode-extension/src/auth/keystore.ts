import * as vscode from "vscode";

const SECRET_KEY = "leetcodecity.apiKey";

let secrets: vscode.SecretStorage;
let cachedKey: string | undefined;

export function initKeystore(context: vscode.ExtensionContext) {
  secrets = context.secrets;
  // Pre-cache key so deactivate can use it without async SecretStorage
  secrets.get(SECRET_KEY).then((k) => { cachedKey = k; });
  .catch(err => console.error(err))