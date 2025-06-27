import { useEffect, useState } from 'react';
import { BaseError } from 'wagmi';

export function useContractError(error: unknown): string | null {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!error) {
      setErrorMessage(null);
      return;
    }
    let msg = 'Transaction failed';
    console.log('Contract error:', error);
    if (error instanceof BaseError) {
      // Extract a revert error
      const revertError = error.walk((err: any) =>
        err instanceof BaseError && err.name === 'ContractFunctionExecutionError'
      );
      msg = revertError?.shortMessage || error.shortMessage || error.message;
    }
    setErrorMessage(msg);
  }, [error]);

  return errorMessage;
}