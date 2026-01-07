interface DeliveryDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
}

export default function DeliveryDatePicker({
  value,
  onChange,
  label = '배송일',
  description,
}: DeliveryDatePickerProps) {
  return (
    <div className="card p-6 h-full bg-gradient-to-r from-primary-50 to-blue-50 border-2 border-primary-200 dark:from-primary-900/20 dark:to-blue-900/20 dark:border-primary-700">
      <div className="flex items-center gap-4 h-full">
        <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/50 rounded-xl flex items-center justify-center">
          <svg
            className="w-7 h-7 text-primary-600 dark:text-primary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <label className="block text-lg font-bold text-primary-900 dark:text-primary-100 mb-1">
            {label}
          </label>
          {description && (
            <p className="text-sm text-primary-600 dark:text-primary-400">{description}</p>
          )}
        </div>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field w-auto text-lg font-semibold px-4 py-3"
        />
      </div>
    </div>
  );
}
