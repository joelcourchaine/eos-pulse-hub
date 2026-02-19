import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const MurrayAssessment = () => {
  const navigate = useNavigate();
  const hostname = window.location.hostname;
  const isMurrayDomain =
    hostname === "murraygrowth.ca" ||
    hostname === "www.murraygrowth.ca" ||
    hostname === "localhost";

  useEffect(() => {
    if (!isMurrayDomain) {
      navigate("/", { replace: true });
    }
  }, [isMurrayDomain, navigate]);

  if (!isMurrayDomain) return null;

  return (
    <iframe
      src="/assessments/murray-hyundai-winnipeg.html"
      title="Murray Hyundai Winnipeg — Service Assessment"
      style={{
        width: "100%",
        height: "100vh",
        border: "none",
      }}
    />
  );
};

export default MurrayAssessment;
