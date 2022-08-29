// @flow

import "../live-common-setup-base";
import { ipcMain, dialog, BrowserWindow } from "electron";
import contextMenu from "electron-context-menu";
import { log } from "@ledgerhq/logs";
import logger, { enableDebugLogger } from "../logger";
import LoggerTransport from "~/logger/logger-transport-main";
import LoggerTransportFirmware from "~/logger/logger-transport-firmware";
import { fsWriteFile, fsReadFile, fsUnlink } from "~/helpers/fs";
import updater from "./updater";
import resolveUserDataDirectory from "~/helpers/resolveUserDataDirectory";
import path from "path";
import { enableFileLogger } from "~/logger/logger-transport-file";

const loggerTransport = new LoggerTransport();
const loggerFirmwareTransport = new LoggerTransportFirmware();
logger.add(loggerTransport);
logger.add(loggerFirmwareTransport);

if (process.env.DEV_TOOLS || process.env.DEBUG_LOGS) {
  enableDebugLogger();
}

if (process.env.DESKTOP_LOGS_FILE) {
  enableFileLogger();
}

ipcMain.on("mainCrashTest", () => {
  logger.critical(new Error("CrashTestMain"));
});

ipcMain.on("updater", (e, type) => {
  updater(type);
});

ipcMain.handle("save-logs", async (event, path: { canceled: boolean, filePath: string }) =>
  Promise.resolve().then(
    () =>
      !path.canceled &&
      path.filePath &&
      fsWriteFile(path.filePath, JSON.stringify(loggerTransport.logs)),
  ),
);

ipcMain.handle(
  "export-operations",
  async (event, path: { canceled: boolean, filePath: string }, csv: string): Promise<boolean> => {
    try {
      if (!path.canceled && path.filePath && csv) {
        await fsWriteFile(path.filePath, csv);
        return true;
      }
    } catch (error) {}

    return false;
  },
);

const lssFileName = "lss.json";

ipcMain.handle("generate-lss-config", async (event, data: string): Promise<boolean> => {
  const userDataDirectory = resolveUserDataDirectory();
  const filePath = path.resolve(userDataDirectory, lssFileName);
  if (filePath) {
    if (filePath && data) {
      await fsWriteFile(filePath, data, { mode: "640" });
      log("satstack", "wrote to lss.json file");
      return true;
    }
  }

  return false;
});

ipcMain.handle("delete-lss-config", async (event): Promise<boolean> => {
  const userDataDirectory = resolveUserDataDirectory();
  const filePath = path.resolve(userDataDirectory, lssFileName);
  if (filePath) {
    await fsUnlink(filePath);
    log("satstack", "deleted lss.json file");
    return true;
  }
  return false;
});

ipcMain.handle("load-lss-config", async (event): Promise<?string> => {
  try {
    const userDataDirectory = resolveUserDataDirectory();
    const filePath = path.resolve(userDataDirectory, lssFileName);
    if (filePath) {
      const contents = await fsReadFile(filePath, "utf8");
      log("satstack", `loaded lss.json file with length ${contents.length}`);
      return contents;
    }
  } catch (e) {
    log("satstack", "tried to load lss.json");
  }

  return undefined;
});

ipcMain.handle("open-file-dialog", async (event, title: string): Promise<?string> => {
  try {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
      title,
      properties: ["openFile"],
    });
    if (result.filePaths.length) {
      const contents = await fsReadFile(result.filePaths[0], "utf8");
      return contents;
    }
  } catch(e) {
  }

  return undefined;
});

ipcMain.handle("save-file-dialog", async (event, title: string, contents: string): Promise<boolean> => {
  try {
    const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
      title,
    });
    if (result.filePath) {
      await fsWriteFile(result.filePath, contents);
      return true;
    }
  } catch(e) {
  }

  return false;
});

process.setMaxListeners(0);

// eslint-disable-next-line no-console
console.log(`Ledger Live ${__APP_VERSION__}`);

contextMenu({
  showInspectElement: __DEV__,
  showCopyImageAddress: false,
  // TODO: i18n for labels
  labels: {
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    copyLink: "Copy Link",
    inspect: "Inspect element",
  },
});

logger.info(`Ledger Live version: ${__APP_VERSION__}`, { type: "system-info" });
