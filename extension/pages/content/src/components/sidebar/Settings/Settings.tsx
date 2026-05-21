import React from 'react';
import { useUserPreferences, useAvailableTools } from '@src/hooks';
import { Card, CardContent } from '@src/components/ui/card';
import { Typography } from '../ui';
import { AutomationService } from '@src/services/automation.service';
import { cn } from '@src/lib/utils';
import { createLogger } from '@extension/shared/lib/logger';

// Default delay values in seconds

const logger = createLogger('Settings');

const DEFAULT_DELAYS = {
  autoInsertDelay: 2,
  autoSubmitDelay: 2,
  autoExecuteDelay: 2
} as const;

function isForcedAutoExecuteTool(name: string): boolean {
  return name.endsWith('_ack') || name.endsWith('_pending');
}

const Settings: React.FC = () => {
  const { preferences, updatePreferences } = useUserPreferences();
  const { tools } = useAvailableTools();

  // Handle delay input changes
  const handleDelayChange = (type: 'autoInsert' | 'autoSubmit' | 'autoExecute', value: string) => {
    const delay = Math.max(0, parseInt(value) || 0); // Ensure non-negative integer
    logger.debug(`${type} delay changed to: ${delay}`);
    
    // Update user preferences store with the new delay
    updatePreferences({ [`${type}Delay`]: delay });

    // Store in localStorage
    try {
      const storedDelays = JSON.parse(localStorage.getItem('mcpDelaySettings') || '{}');
      localStorage.setItem('mcpDelaySettings', JSON.stringify({
        ...storedDelays,
        [`${type}Delay`]: delay
      }));
    } catch (error) {
      logger.error('[Settings] Error storing delay settings:', error);
    }

    // Update automation state on window
    AutomationService.getInstance().updateAutomationStateOnWindow().catch(console.error);
  };

  const handleAutoExecuteToolToggle = (toolName: string, enabled: boolean) => {
    const updated = { ...preferences.autoExecuteTools, [toolName]: enabled };
    updatePreferences({ autoExecuteTools: updated });
    AutomationService.getInstance().updateAutomationStateOnWindow().catch(console.error);
  };

  // Load stored delays on component mount, set default to 2 seconds if not set
  React.useEffect(() => {
    try {
      const storedDelays = JSON.parse(localStorage.getItem('mcpDelaySettings') || '{}');
      // If no stored delays, use defaults
      if (Object.keys(storedDelays).length === 0) {
        updatePreferences(DEFAULT_DELAYS);
        localStorage.setItem('mcpDelaySettings', JSON.stringify(DEFAULT_DELAYS));
      } else {
        // Use stored delays
        updatePreferences(storedDelays);
      }
    } catch (error) {
      logger.error('[Settings] Error loading stored delay settings:', error);
      // Set defaults on error
      updatePreferences(DEFAULT_DELAYS);
      localStorage.setItem('mcpDelaySettings', JSON.stringify(DEFAULT_DELAYS));
    }
  }, [updatePreferences]);

  const sortedTools = React.useMemo(
    () => [...tools].sort((a, b) => a.name.localeCompare(b.name)),
    [tools]
  );

  return (
    <div className="p-4 space-y-4">
      <Card className="border-slate-200 dark:border-slate-700 dark:bg-slate-800">
        <CardContent className="p-4">
          <Typography variant="h4" className="mb-4 text-slate-700 dark:text-slate-300">
            Automation Delay Settings
          </Typography>
          
          <div className="space-y-4">
            {/* Auto Insert Delay */}
            <div>
              <label
                htmlFor="auto-insert-delay"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Auto Insert Delay (seconds)
              </label>
              <input
                id="auto-insert-delay"
                type="number"
                min="0"
                value={preferences.autoInsertDelay || 0}
                onChange={(e) => handleDelayChange('autoInsert', e.target.value)}
                disabled={false}
                className={cn(
                  "w-full p-2 text-sm border rounded-md",
                  "bg-white dark:bg-slate-900",
                  "border-slate-300 dark:border-slate-600",
                  "text-slate-900 dark:text-slate-100"
                )}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Delay before auto-inserting content
              </p>
            </div>

            {/* Auto Submit Delay */}
            <div>
              <label
                htmlFor="auto-submit-delay"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Auto Submit Delay (seconds)
              </label>
              <input
                id="auto-submit-delay"
                type="number"
                min="0"
                value={preferences.autoSubmitDelay || 0}
                onChange={(e) => handleDelayChange('autoSubmit', e.target.value)}
                disabled={false}
                className={cn(
                  "w-full p-2 text-sm border rounded-md",
                  "bg-white dark:bg-slate-900",
                  "border-slate-300 dark:border-slate-600",
                  "text-slate-900 dark:text-slate-100"
                )}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Delay before auto-submitting form
              </p>
            </div>

            {/* Auto Execute Delay */}
            <div>
              <label
                htmlFor="auto-execute-delay"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Auto Execute Delay (seconds)
              </label>
              <input
                id="auto-execute-delay"
                type="number"
                min="0"
                value={preferences.autoExecuteDelay || 0}
                onChange={(e) => handleDelayChange('autoExecute', e.target.value)}
                disabled={false}
                className={cn(
                  "w-full p-2 text-sm border rounded-md",
                  "bg-white dark:bg-slate-900",
                  "border-slate-300 dark:border-slate-600",
                  "text-slate-900 dark:text-slate-100"
                )}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Delay before auto-executing functions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {sortedTools.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-700 dark:bg-slate-800">
          <CardContent className="p-4">
            <Typography variant="h4" className="mb-1 text-slate-700 dark:text-slate-300">
              Per-Tool Auto-Execute
            </Typography>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Tools ending in <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">_ack</code> or <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">_pending</code> always auto-execute.
            </p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {sortedTools.map(tool => {
                const isForced = isForcedAutoExecuteTool(tool.name);
                const isEnabled = preferences.autoExecuteTools?.[tool.name] !== false;
                return (
                  <div
                    key={tool.name}
                    className={cn(
                      "flex items-center justify-between py-1.5 px-2 rounded",
                      "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    )}
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate mr-2">
                      {tool.name}
                    </span>
                    {isForced ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                        Always
                      </span>
                    ) : (
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => handleAutoExecuteToolToggle(tool.name, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={cn(
                          "w-8 h-4 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all",
                          isEnabled
                            ? "bg-blue-600 dark:bg-blue-500"
                            : "bg-slate-300 dark:bg-slate-600"
                        )} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;
