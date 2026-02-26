type VotingToggleProps = {
  isOpen: boolean;
  onChange: (isOpen: boolean) => void;
  disabled?: boolean;
};

export default function VotingToggle({ isOpen, onChange, disabled = false }: VotingToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">Voting</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {isOpen
            ? "Participants can currently vote on questions."
            : "Voting is frozen — participants cannot vote."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!isOpen)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
          isOpen ? "bg-brand-700" : "bg-gray-300"
        }`}
        role="switch"
        aria-checked={isOpen}
        title={isOpen ? "Click to close voting" : "Click to open voting"}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
            isOpen ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span
        className={`ml-3 text-xs font-semibold shrink-0 ${
          isOpen ? "text-brand-700" : "text-gray-500"
        }`}
      >
        {isOpen ? "OPEN" : "CLOSED"}
      </span>
    </div>
  );
}
