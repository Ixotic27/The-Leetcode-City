import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";

export interface LanguageConfig {
  id: string;
  name: string;
  extension: string;
  compileCmd?: (filePath: string, destDir: string) => string;
  runCmd: (filePath: string, destDir: string) => string;
  isAvailable: () => Promise<boolean>;
}

// Helper to check if a command exists in PATH
function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const checkCmd = process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`;
    cp.exec(checkCmd, (err) => {
      resolve(!err);
    });
  });
}

export const LANGUAGES: Record<string, LanguageConfig> = {
  python: {
    id: "python",
    name: "Python",
    extension: "py",
    runCmd: (filePath) => {
      // Use python3 if available, fallback to python
      const pythonCmd = process.platform === "win32" ? "python" : "python3";
      return `"${pythonCmd}" "${filePath}"`;
    },
    isAvailable: async () => {
      const hasPython3 = await commandExists("python3");
      if (hasPython3) return true;
      return commandExists("python");
    }
  },
  javascript: {
    id: "javascript",
    name: "JavaScript",
    extension: "js",
    runCmd: (filePath) => `node "${filePath}"`,
    isAvailable: () => commandExists("node")
  },
  typescript: {
    id: "typescript",
    name: "TypeScript",
    extension: "ts",
    runCmd: (filePath) => `npx tsx "${filePath}"`,
    isAvailable: async () => {
      const hasNode = await commandExists("node");
      if (!hasNode) return false;
      return true; // We can run via npx tsx directly
    }
  },
  cpp: {
    id: "cpp",
    name: "C++",
    extension: "cpp",
    compileCmd: (filePath, destDir) => {
      const executableName = process.platform === "win32" ? "solution.exe" : "solution";
      const destPath = path.join(destDir, executableName);
      return `g++ -O3 -std=c++17 "${filePath}" -o "${destPath}"`;
    },
    runCmd: (_, destDir) => {
      const executableName = process.platform === "win32" ? "solution.exe" : "solution";
      const destPath = path.join(destDir, executableName);
      return `"${destPath}"`;
    },
    isAvailable: () => commandExists("g++")
  },
  java: {
    id: "java",
    name: "Java",
    extension: "java",
    compileCmd: (filePath, destDir) => `javac -d "${destDir}" "${filePath}"`,
    runCmd: (filePath, destDir) => {
      const className = path.basename(filePath, ".java");
      return `java -cp "${destDir}" ${className}`;
    },
    isAvailable: async () => {
      const hasJavac = await commandExists("javac");
      const hasJava = await commandExists("java");
      return hasJavac && hasJava;
    }
  },
  go: {
    id: "go",
    name: "Go",
    extension: "go",
    runCmd: (filePath) => `go run "${filePath}"`,
    isAvailable: () => commandExists("go")
  },
  rust: {
    id: "rust",
    name: "Rust",
    extension: "rs",
    compileCmd: (filePath, destDir) => {
      const executableName = process.platform === "win32" ? "solution.exe" : "solution";
      const destPath = path.join(destDir, executableName);
      return `rustc -O "${filePath}" -o "${destPath}"`;
    },
    runCmd: (_, destDir) => {
      const executableName = process.platform === "win32" ? "solution.exe" : "solution";
      const destPath = path.join(destDir, executableName);
      return `"${destPath}"`;
    },
    isAvailable: () => commandExists("rustc")
  }
};

export function getLanguageConfigByExtension(ext: string): LanguageConfig | null {
  const cleanExt = ext.startsWith(".") ? ext.substring(1) : ext;
  for (const lang of Object.values(LANGUAGES)) {
    if (lang.extension === cleanExt) {
      return lang;
    }
  }
  return null;
}

export async function getAvailableLanguages(): Promise<LanguageConfig[]> {
  const available: LanguageConfig[] = [];
  for (const lang of Object.values(LANGUAGES)) {
    if (await lang.isAvailable()) {
      available.push(lang);
    }
  }
  return available;
}
