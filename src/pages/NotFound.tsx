import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Compass, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
          <Compass className="h-5 w-5" />
        </div>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Error 404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The route <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{location.pathname}</code> doesn't exist in this workspace.
        </p>
        <Button asChild className="mt-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
