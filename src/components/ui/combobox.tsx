"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
  sheetNames: string[]
  selectedSheet: string
  onSheetSelect: (sheet: string) => void
}

export function ComboboxDemo({ sheetNames, selectedSheet, onSheetSelect }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(selectedSheet)

  React.useEffect(() => {
    setValue(selectedSheet)
  }, [selectedSheet])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {value
            ? sheetNames.find((sheet: string) => sheet === value)
            : "Select a sheet..."}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search sheets..." className="h-9" />
          <CommandList>
            <CommandEmpty>No sheet found.</CommandEmpty>
            <CommandGroup>
              {sheetNames.map((sheet: string) => (
                <CommandItem
                  key={sheet}
                  value={sheet}
                  onSelect={(currentValue: string) => {
                    setValue(currentValue === value ? "" : currentValue)
                    onSheetSelect(currentValue)
                    setOpen(false)
                  }}
                >
                  {sheet}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === sheet ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
