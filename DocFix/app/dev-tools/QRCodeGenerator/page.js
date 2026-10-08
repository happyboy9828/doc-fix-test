"use client";

import { useEffect, useRef } from "react";
import { mountQrCodeGenerator } from "../../../utils/dev-tools/QRCodeGenerator/QRCodeGenerator";
import "../../../utils/dev-tools/QRCodeGenerator/QRCodeGenerator.css";

export default function QrCodeGeneratorPage() {
  const ref = useRef(null);

  useEffect(() => {
    const tool = mountQrCodeGenerator(ref.current);
    return () => tool.destroy();
  }, []);

  return <div ref={ref} className="tool-page" />;
}
