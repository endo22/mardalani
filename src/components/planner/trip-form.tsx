"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { destinations } from "@/data/destinations";
import { itineraryGenerationService } from "@/lib/itinerary-service";
import { tripFormSchema, type TripFormValues } from "@/lib/schemas";
import { saveItinerary } from "@/lib/storage";
import type { TravelInterest } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

const INTEREST_OPTIONS: { value: TravelInterest; label: string }[] = [
  { value: "nature", label: "Nature" },
  { value: "culture", label: "Culture" },
  { value: "culinary", label: "Culinary" },
  { value: "beach", label: "Beach" },
  { value: "adventure", label: "Adventure" },
  { value: "relaxation", label: "Relaxation" },
];

interface TripFormProps {
  defaults?: Partial<TripFormValues>;
}

const budgetPresets: Record<TripFormValues["budgetTier"], number> = {
  budget: 3_500_000,
  moderate: 7_500_000,
  premium: 15_000_000,
};

function defaultDates() {
  const start = new Date();
  start.setDate(start.getDate() + 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function TripForm({ defaults }: TripFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dates = useMemo(() => defaultDates(), []);

  const initialTier = defaults?.budgetTier ?? "moderate";
  const [budgetTier, setBudgetTier] =
    useState<TripFormValues["budgetTier"]>(initialTier);

  const [selectedInterests, setSelectedInterests] = useState<TravelInterest[]>(
    defaults?.interests ?? [],
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      destination: defaults?.destination ?? "bali",
      startDate: defaults?.startDate ?? dates.startDate,
      endDate: defaults?.endDate ?? dates.endDate,
      travelers: defaults?.travelers ?? 2,
      travelStyle: defaults?.travelStyle ?? "balanced",
      budgetTier: initialTier,
      budgetAmount: defaults?.budgetAmount ?? budgetPresets[initialTier],
      transport: defaults?.transport ?? "mixed",
      interests: defaults?.interests ?? [],
      notes: defaults?.notes ?? "",
    },
    mode: "onBlur",
  });

  function toggleInterest(interest: TravelInterest) {
    const next = selectedInterests.includes(interest)
      ? selectedInterests.filter((i) => i !== interest)
      : [...selectedInterests, interest];
    setSelectedInterests(next);
    setValue("interests", next, { shouldValidate: true });
  }

  async function onSubmit(values: TripFormValues) {
    setSubmitError(null);
    try {
      const itinerary = await itineraryGenerationService.generate({
        ...values,
        destinationSlug: values.destination,
      });
      saveItinerary(itinerary);
      router.push("/itinerary");
    } catch {
      setSubmitError(
        "We couldn’t generate that itinerary. Check your dates and try again.",
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 rounded-[var(--radius-lg)] bg-white p-6 shadow-[var(--shadow-soft)] md:p-8"
      noValidate
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Destination"
          htmlFor="destination"
          error={errors.destination?.message}
          required
        >
          <Select
            id="destination"
            aria-required
            aria-invalid={Boolean(errors.destination)}
            aria-describedby={
              errors.destination ? "destination-error" : undefined
            }
            {...register("destination")}
          >
            {destinations.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
                {!d.hasFullTemplate ? " (preview scaffold)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Travelers"
          htmlFor="travelers"
          error={errors.travelers?.message}
          required
        >
          <Input
            id="travelers"
            type="number"
            min={1}
            max={12}
            aria-required
            aria-invalid={Boolean(errors.travelers)}
            aria-describedby={errors.travelers ? "travelers-error" : undefined}
            {...register("travelers", { valueAsNumber: true })}
          />
        </Field>

        <Field
          label="Start date"
          htmlFor="startDate"
          error={errors.startDate?.message}
          required
        >
          <Input
            id="startDate"
            type="date"
            aria-required
            aria-invalid={Boolean(errors.startDate)}
            aria-describedby={errors.startDate ? "startDate-error" : undefined}
            {...register("startDate")}
          />
        </Field>

        <Field
          label="End date"
          htmlFor="endDate"
          error={errors.endDate?.message}
          required
        >
          <Input
            id="endDate"
            type="date"
            aria-required
            aria-invalid={Boolean(errors.endDate)}
            aria-describedby={errors.endDate ? "endDate-error" : undefined}
            {...register("endDate")}
          />
        </Field>

        <Field
          label="Travel style"
          htmlFor="travelStyle"
          error={errors.travelStyle?.message}
          required
        >
          <Select
            id="travelStyle"
            aria-required
            aria-invalid={Boolean(errors.travelStyle)}
            {...register("travelStyle")}
          >
            <option value="relaxed">Relaxed</option>
            <option value="balanced">Balanced</option>
            <option value="adventure">Adventure</option>
            <option value="cultural">Cultural</option>
            <option value="luxury">Luxury</option>
          </Select>
        </Field>

        <Field
          label="Transport preference"
          htmlFor="transport"
          error={errors.transport?.message}
          required
        >
          <Select
            id="transport"
            aria-required
            aria-invalid={Boolean(errors.transport)}
            {...register("transport")}
          >
            <option value="public">Public transport</option>
            <option value="private">Private car / driver</option>
            <option value="mixed">Mixed</option>
            <option value="walking">Mostly walking</option>
          </Select>
        </Field>

        <Field
          label="Budget tier"
          htmlFor="budgetTier"
          error={errors.budgetTier?.message}
          required
          hint="Updates the suggested total — you can still edit the amount."
        >
          <Select
            id="budgetTier"
            aria-required
            aria-invalid={Boolean(errors.budgetTier)}
            aria-describedby="budgetTier-hint"
            {...register("budgetTier")}
            onChange={(e) => {
              const tier = e.target.value as TripFormValues["budgetTier"];
              setBudgetTier(tier);
              setValue("budgetTier", tier, { shouldValidate: true });
              setValue("budgetAmount", budgetPresets[tier], {
                shouldValidate: true,
              });
            }}
          >
            <option value="budget">Budget</option>
            <option value="moderate">Moderate</option>
            <option value="premium">Premium</option>
          </Select>
        </Field>

        <Field
          label="Total budget (IDR)"
          htmlFor="budgetAmount"
          error={errors.budgetAmount?.message}
          required
          hint={`Suggested for ${budgetTier}: Rp${budgetPresets[budgetTier].toLocaleString("id-ID")}`}
        >
          <Input
            id="budgetAmount"
            type="number"
            step={100000}
            min={500000}
            aria-required
            aria-invalid={Boolean(errors.budgetAmount)}
            aria-describedby={
              [
                "budgetAmount-hint",
                errors.budgetAmount ? "budgetAmount-error" : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            {...register("budgetAmount", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="text-body-sm font-medium text-charcoal">
          Interests (optional)
        </legend>
        <p className="mt-1 text-caption text-muted">
          When catalog data allows, matching attractions are preferred. Demo
          estimates only.
        </p>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Travel interests"
        >
          {INTEREST_OPTIONS.map((opt) => {
            const checked = selectedInterests.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-[var(--radius-md)] px-3 py-1.5 text-body-sm font-medium ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${
                  checked
                    ? "bg-forest text-cream ring-forest"
                    : "bg-white text-forest ring-forest/20 hover:bg-forest/5"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleInterest(opt.value)}
                  data-testid={`interest-${opt.value}`}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
        {errors.interests?.message ? (
          <p role="alert" className="mt-1 text-caption text-danger">
            {errors.interests.message}
          </p>
        ) : null}
      </fieldset>

      <Field
        label="Notes (optional)"
        htmlFor="notes"
        error={errors.notes?.message}
      >
        <Textarea
          id="notes"
          maxLength={500}
          placeholder="e.g. Prefer morning starts, vegetarian meals, avoid long hikes…"
          {...register("notes")}
        />
      </Field>

      {submitError ? (
        <p role="alert" className="text-body-sm text-danger">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-muted">
          Demo estimates only. Saved in this browser session — not synced across
          devices.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Generating…
            </>
          ) : (
            "Generate itinerary"
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;

  return (
    <div>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </Label>
      {children}
      {hint ? (
        <p id={hintId} className="mt-1 text-caption text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
