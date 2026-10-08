"use client";

import { useEffect, useRef } from "react";
import { createQRScanner } from "../../../utils/dev-tools/QRCodeScanner/QRCodeScanner";
import "../../../utils/dev-tools/QRCodeScanner/QRCodeScanner.css";

export default function QRScannerPage() {
  const ref = useRef(null);

  useEffect(() => {
    const destroy = createQRScanner(ref.current);
    return destroy;
  }, []);

  return <div ref={ref} className="tool-page" />;
}
