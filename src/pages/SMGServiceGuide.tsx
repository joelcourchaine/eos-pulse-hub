import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SMGServiceGuide = () => {
  const navigate = useNavigate();
  const hostname = window.location.hostname;
  const isSMGDomain = hostname === "smggrowth.ca" || hostname === "www.smggrowth.ca";

  useEffect(() => {
    if (!isSMGDomain) navigate("/", { replace: true });
  }, [isSMGDomain, navigate]);

  if (!isSMGDomain) return null;

  return (
    <iframe
      src="/assessments/smg-service-guide.html"
      title="SMG Service Guide — Tricare Claims Reference"
      style={{ width: "100%", height: "100vh", border: "none" }}
    />
  );
};

export default SMGServiceGuide;
