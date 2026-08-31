import { Navigate, useLocation, useParams } from "react-router-dom";
import { rdlEntityRoute } from "../rdl/catalog";

type Props = {
  entityType: string;
  paramName: string;
};

const CFIHOS_SOURCE_KEY = "cfihos";
const CFIHOS_RELEASE_KEY = "cfihos-2.0";

export function RdlLegacyEntityRedirect({ entityType, paramName }: Props) {
  const params = useParams();
  const location = useLocation();
  const nativeIdentifier = params[paramName];

  if (!nativeIdentifier) {
    return <Navigate to="/search?source=cfihos&release=cfihos-2.0" replace />;
  }

  const canonicalRoute = rdlEntityRoute(
    CFIHOS_SOURCE_KEY,
    CFIHOS_RELEASE_KEY,
    entityType,
    nativeIdentifier,
  );

  return <Navigate to={`${canonicalRoute}${location.search}`} replace />;
}
