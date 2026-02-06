import { useCallback, useState } from "react";

interface UseStepperOptions {
  totalSteps: number;
  initialStep?: number;
}

export function useStepper({ totalSteps, initialStep = 1 }: UseStepperOptions) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const goToStep = useCallback(
    (step: number) => {
      if (step < 1 || step > totalSteps) return;
      setDirection(step > currentStep ? "forward" : "backward");
      setCurrentStep(step);
    },
    [currentStep, totalSteps],
  );

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setDirection("backward");
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const goForward = useCallback(() => {
    if (currentStep < totalSteps) {
      setDirection("forward");
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, totalSteps]);

  const completeStep = useCallback(
    (step?: number) => {
      const target = step ?? currentStep;
      setCompletedSteps((prev) => new Set(prev).add(target));
    },
    [currentStep],
  );

  return {
    currentStep,
    direction,
    completedSteps,
    goToStep,
    goBack,
    goForward,
    completeStep,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === totalSteps,
  };
}
