import { Check } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

interface StepConfig {
  title: string;
  description?: string;
  optional?: boolean;
}

interface StepperProps {
  steps: StepConfig[];
  currentStep: number;
  completedSteps?: Set<number>;
  className?: string;
}

function Stepper({ steps, currentStep, completedSteps = new Set(), className }: StepperProps) {
  return (
    <div className={cn("flex items-start", className)}>
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = completedSteps.has(stepNumber);
        const isCurrent = stepNumber === currentStep;
        const isFuture = stepNumber > currentStep && !isCompleted;

        return (
          <div key={stepNumber} className="flex flex-1 items-start">
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center font-medium text-sm transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && !isCompleted && "bg-primary text-primary-foreground",
                  isFuture && "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
              </div>

              <div
                className={cn(
                  "mt-2 font-medium text-xs",
                  isCurrent && "font-bold",
                  isFuture && "text-muted-foreground",
                )}
              >
                {step.title}
              </div>

              {(step.description || step.optional) && (
                <div
                  className={cn(
                    "mt-0.5 text-[10px] leading-tight",
                    isFuture ? "text-muted-foreground" : "text-muted-foreground/80",
                  )}
                >
                  {step.description}
                  {step.optional && <span className="ml-0.5 italic opacity-70">(optional)</span>}
                </div>
              )}
            </div>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mt-4 h-0.5 flex-1 transition-colors",
                  isCompleted ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface StepContentProps {
  step: number;
  direction: "forward" | "backward";
  children: React.ReactNode;
  className?: string;
}

function StepContent({ step, direction, children, className }: StepContentProps) {
  return (
    <div
      key={step}
      className={cn(
        "fade-in animate-in duration-300",
        direction === "forward" ? "slide-in-from-right-4" : "slide-in-from-left-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { Stepper, StepContent };
export type { StepConfig, StepperProps, StepContentProps };
