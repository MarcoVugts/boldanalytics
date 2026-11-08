"use client";

import { createContext, useContext } from "react";

/** Set by ShareCard while a card is rendered for image export, so charts can adapt (e.g. taller in portrait). */
export type ExportState = { exporting: boolean; format: "wide" | "portrait" };

export const ExportContext = createContext<ExportState>({ exporting: false, format: "wide" });

export const useExport = () => useContext(ExportContext);
