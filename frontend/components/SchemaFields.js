import { useState, useEffect } from 'react';
import { Type } from 'opa-builder/lib';

const baseInputClassName =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent text-gray-900 placeholder-gray-500';

/**
 * Address field component for Ethereum addresses
 */
export const AddressField = ({ value, onChange, placeholder, required }) => {
  const [error, setError] = useState('');

  const validateAddress = (addr) => {
    if (!addr) return '';
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return 'Must be a valid Ethereum address (0x + 40 hex characters)';
    }
    return '';
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setError(validateAddress(newValue));
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || '0x...'}
        className={`${baseInputClassName} ${error ? 'border-red-500' : ''}`}
        required={required}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

/**
 * Uint256 field component for large numbers
 */
export const Uint256Field = ({ value, onChange, placeholder, required }) => {
  const [error, setError] = useState('');

  const validateUint256 = (val) => {
    if (!val) return '';
    if (!/^[0-9]+$/.test(val)) {
      return 'Must contain only digits';
    }
    try {
      const bigInt = BigInt(val);
      if (bigInt < 0n || bigInt > 2n ** 256n - 1n) {
        return 'Value out of uint256 range';
      }
    } catch {
      return 'Invalid number format';
    }
    return '';
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setError(validateUint256(newValue));
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || '0'}
        className={`${baseInputClassName} ${error ? 'border-red-500' : ''}`}
        required={required}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

/**
 * Maker token amount field component - accepts integer/floating point without conversion
 */
export const MakerTokenAmountField = ({
  value,
  onChange,
  placeholder,
  required,
}) => {
  const [error, setError] = useState('');

  const validateNumericAmount = (val) => {
    if (!val) return '';

    // Allow decimal numbers
    if (!/^\d*\.?\d*$/.test(val)) {
      return 'Must be a valid number';
    }

    if (val === '.' || val === '') return '';

    try {
      const num = parseFloat(val);
      if (num < 0) {
        return 'Amount must be non-negative';
      }
    } catch {
      return 'Invalid number format';
    }

    return '';
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    const validationError = validateNumericAmount(newValue);
    setError(validationError);

    // Store value as-is without conversion
    onChange(newValue);
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || 'Maker token amount (e.g. 1.5)'}
        className={`${baseInputClassName} ${error ? 'border-red-500' : ''}`}
        required={required}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <p className="text-xs text-gray-400 mt-1">
        Enter numeric amount (stored as entered)
      </p>
    </div>
  );
};

/**
 * Taker token amount field component - accepts integer/floating point without conversion
 */
export const TakerTokenAmountField = ({
  value,
  onChange,
  placeholder,
  required,
}) => {
  const [error, setError] = useState('');

  const validateNumericAmount = (val) => {
    if (!val) return '';

    // Allow decimal numbers
    if (!/^\d*\.?\d*$/.test(val)) {
      return 'Must be a valid number';
    }

    if (val === '.' || val === '') return '';

    try {
      const num = parseFloat(val);
      if (num < 0) {
        return 'Amount must be non-negative';
      }
    } catch {
      return 'Invalid number format';
    }

    return '';
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    const validationError = validateNumericAmount(newValue);
    setError(validationError);

    // Store value as-is without conversion
    onChange(newValue);
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || 'Taker token amount (e.g. 1.5)'}
        className={`${baseInputClassName} ${error ? 'border-red-500' : ''}`}
        required={required}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <p className="text-xs text-gray-400 mt-1">
        Enter numeric amount (stored as entered)
      </p>
    </div>
  );
};

/**
 * Bytes32 field component for 32-byte hex values
 */
export const Bytes32Field = ({ value, onChange, placeholder, required }) => {
  const [error, setError] = useState('');

  const validateBytes32 = (val) => {
    if (!val) return '';
    if (!/^0x[a-fA-F0-9]{64}$/.test(val)) {
      return 'Must be a valid bytes32 value (0x + 64 hex characters)';
    }
    return '';
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setError(validateBytes32(newValue));
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || '0x...'}
        className={`${baseInputClassName} ${error ? 'border-red-500' : ''}`}
        required={required}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

/**
 * Bytes field component for variable-length hex values
 */
export const BytesField = ({ value, onChange, placeholder, required }) => {
  const [error, setError] = useState('');

  const validateBytes = (val) => {
    if (!val) return '';
    if (!/^0x([a-fA-F0-9]{2})*$/.test(val)) {
      return 'Must be valid hex bytes (0x + even number of hex characters)';
    }
    return '';
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setError(validateBytes(newValue));
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder || '0x...'}
        className={`${baseInputClassName} ${error ? 'border-red-500' : ''}`}
        required={required}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};

/**
 * Boolean field component with toggle switch
 */
export const BooleanField = ({ value, onChange, placeholder, required }) => {
  const boolValue = value === 'true' || value === true;

  const handleChange = (e) => {
    onChange(e.target.checked.toString());
  };

  return (
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={boolValue}
        onChange={handleChange}
        className="h-4 w-4 text-primary-orange focus:ring-primary-orange border-gray-300 rounded"
        required={required}
      />
      <span className="text-sm text-gray-700">
        {placeholder || 'Enable option'}
      </span>
    </div>
  );
};

/**
 * Timestamp field component with date/time picker
 */
export const TimestampField = ({ value, onChange, placeholder, required }) => {
  const [error, setError] = useState('');

  const validateTimestamp = (val) => {
    if (!val) return '';
    if (!/^[0-9]+$/.test(val)) {
      return 'Must be a valid Unix timestamp (numbers only)';
    }
    const num = Number(val);
    if (num < 0) {
      return 'Timestamp must be non-negative';
    }
    return '';
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setError(validateTimestamp(newValue));
  };

  const handleDateTimeChange = (e) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const timestamp = Math.floor(
        new Date(dateValue).getTime() / 1000
      ).toString();
      onChange(timestamp);
      setError('');
    }
  };

  const getDateTimeValue = () => {
    if (!value || !/^[0-9]+$/.test(value)) return '';
    try {
      const date = new Date(Number(value) * 1000);
      return date.toISOString().slice(0, 16); // Format for datetime-local input
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder || 'Unix timestamp'}
          className={`${baseInputClassName} ${error ? 'border-red-500' : ''}`}
          required={required}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Or pick date/time:
        </label>
        <input
          type="datetime-local"
          value={getDateTimeValue()}
          onChange={handleDateTimeChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent text-gray-900 text-sm"
        />
      </div>
    </div>
  );
};

/**
 * Generic fallback field component
 */
export const GenericField = ({ value, onChange, placeholder, required }) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={baseInputClassName}
      required={required}
    />
  );
};

/**
 * Field type mapper - returns the appropriate component for a given type
 */
export const getFieldComponent = (type) => {
  if (type === Type.address) return AddressField;
  if (type === Type.uint256) return Uint256Field;
  if (type === Type.boolean) return BooleanField;
  if (type === Type.timestamp) return TimestampField;
  if (type === Type.takerTokenAmount) return TakerTokenAmountField;
  return GenericField;
};
