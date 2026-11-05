import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { installPreviewHostBridge } from "@/lib/preview-host-bridge";

const PATHS = ["/", "/magnet/lead"];

export function PreviewBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    return installPreviewHostBridge({
      navigate: (path) => navigate(path),
      getRoutePaths: () => PATHS,
    });
  }, [navigate]);

  return null;
}
