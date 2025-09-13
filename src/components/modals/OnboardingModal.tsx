import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Rocket, Zap, SlidersHorizontal, TestTube2, ChevronRight } from '../icons';
import { useApp } from '../../context/AppContext';

const steps = [
  {
    icon: Rocket,
    title: 'Welcome to SmartReq',
    description: "Your next-generation API workspace. Let's take a quick tour of the features that will supercharge your workflow.",
  },
  {
    icon: Zap,
    title: 'Single & Bulk Modes',
    description: 'Seamlessly switch between debugging a single endpoint and running thousands of data-driven requests at scale. Perfect for both quick checks and heavy-duty load testing.',
  },
  {
    icon: TestTube2,
    title: 'Intelligent Body Builder',
    description: 'Automatically generate hundreds of unique request bodies from a single JSON template. Discover edge cases and ensure your API is robust without manual effort.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Environments & Scripting',
    description: 'Manage variables for different stages (dev, staging, prod) and write JavaScript to automate complex workflows or create dynamic assertions in your tests.',
  },
];

export const OnboardingModal: React.FC = () => {
  const { isOnboardingOpen, setIsOnboardingOpen, setHasOnboarded } = useApp();
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsOnboardingOpen(false);
    setHasOnboarded(true);
  };
  
  const currentStep = steps[step];

  return (
    <Modal show={isOnboardingOpen} onClose={handleClose} size="lg">
      <div className="text-center p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative inline-block mb-6">
                <div className={`absolute -inset-4 bg-primary/20 rounded-full blur-2xl ${step === 0 ? 'animate-pulse' : ''}`} />
                <currentStep.icon className="relative h-14 w-14 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{currentStep.title}</h2>
            <p className="mt-2 text-muted-foreground max-w-md mx-auto">{currentStep.description}</p>
          </motion.div>
        </AnimatePresence>
        
        <div className="mt-8 flex flex-col items-center">
             <div className="flex items-center justify-center gap-2 mb-6">
                {steps.map((_, i) => (
                    <div
                        key={i}
                        onClick={() => setStep(i)}
                        className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${i === step ? 'w-6 bg-primary' : 'w-2 bg-muted hover:bg-border'}`}
                    />
                ))}
            </div>
          <Button onClick={handleNext} className="w-full max-w-xs">
            {step < steps.length - 1 ? 'Next' : 'Get Started'}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </Modal>
  );
};