import React from 'react';
import { Button } from './ui/Button';
import { Import, Plus, Rocket, FilePlus, SlidersHorizontal, TestTube2, Zap } from './icons';

interface WelcomeScreenProps {
  onCreateRequest: () => void;
  onCreateCollection: () => void;
  onImport: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onCreateRequest,
  onCreateCollection,
  onImport,
}) => {
  return (
    <div className="flex-grow flex items-center justify-center p-4 md:p-8">
      <div className="text-center max-w-3xl w-full">
        <div className="relative inline-block mb-6">
            <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse" />
            <Rocket className="relative h-16 w-16 text-primary" />
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Welcome to SmartReq</h1>
        <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
          Your Next-Generation API Workspace. Craft, test, and analyze any API with precision and speed.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-card/80 border border-border rounded-lg p-4 md:p-6 text-left">
                <h2 className="text-lg font-semibold text-foreground mb-4">Get Started</h2>
                <div className="space-y-3">
                    <Button onClick={onCreateRequest} className="w-full justify-start" variant="primary">
                        <FilePlus className="h-4 w-4 mr-3" />
                        Create Your First Request
                    </Button>
                    <Button onClick={onCreateCollection} className="w-full justify-start" variant="secondary">
                        <Plus className="h-4 w-4 mr-3" />
                        Create a New Collection
                    </Button>
                    <Button onClick={onImport} className="w-full justify-start" variant="secondary">
                        <Import className="h-4 w-4 mr-3" />
                        Import a Collection
                    </Button>
                </div>
            </div>

            <div className="bg-card/80 border border-border rounded-lg p-4 md:p-6 text-left">
                <h2 className="text-lg font-semibold text-foreground mb-4">Quick Tour</h2>
                <ul className="space-y-4 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                        <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>
                            <strong className="text-foreground">Single & Bulk Mode:</strong> Seamlessly switch between debugging a single endpoint and running thousands of data-driven requests.
                        </span>
                    </li>
                    <li className="flex items-start gap-3">
                        <SlidersHorizontal className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>
                            <strong className="text-foreground">Environments:</strong> Manage global variables for different stages like development, staging, and production.
                        </span>
                    </li>
                    <li className="flex items-start gap-3">
                        <TestTube2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                         <span>
                            <strong className="text-foreground">Intelligent Body Builder:</strong> Generate hundreds of combinatorial request bodies from a single JSON template for exhaustive testing.
                        </span>
                    </li>
                </ul>
            </div>
        </div>
      </div>
    </div>
  );
};