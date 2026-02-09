import * as React from "react"
import { Check, ChevronDown, MapPin } from "lucide-react"
import { useSearchParams, useNavigate, useLocation } from "react-router-dom"
import { ROUTE_PATHS } from "@/lib"

import { cn } from "@/lib/utils"
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
import { BRAZIL_STATES } from "@/constants/states"

export function StateSelector() {
  const [open, setOpen] = React.useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  
  const currentStateValue = searchParams.get("state")
  const currentStateLabel = BRAZIL_STATES.find(s => s.value === currentStateValue)?.label

  const handleSelect = (value: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    
    if (value === "all") {
        newSearchParams.delete("state");
    } else {
        // Toggle se clicar no mesmo
        if (value === currentStateValue) {
            newSearchParams.delete("state");
        } else {
            newSearchParams.set("state", value);
        }
    }
    
    // Se estiver na rota de explorar, apenas atualiza params
    // Se não, navega para explorar com os params
    if (location.pathname === ROUTE_PATHS.EXPLORE) {
        setSearchParams(newSearchParams);
    } else {
        navigate(`${ROUTE_PATHS.EXPLORE}?${newSearchParams.toString()}`);
    }
    
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-2 px-6 h-12 bg-white border border-gray-200 border-l-gray-200 rounded-r-lg rounded-l-none text-primary cursor-pointer hover:bg-gray-50 transition-colors min-w-[180px] shadow-none">
          <MapPin size={20} className="flex-shrink-0" />
          <span className="truncate font-semibold text-sm flex-1">
            {currentStateLabel || "Qualquer lugar"}
          </span>
          <ChevronDown size={16} className="flex-shrink-0 opacity-70" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar estado..." />
          <CommandList>
            <CommandEmpty>Estado não encontrado.</CommandEmpty>
            <CommandGroup>
                <CommandItem
                  value="all"
                  onSelect={() => handleSelect("all")}
                  className="cursor-pointer font-medium"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !currentStateValue ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Todos os estados
                </CommandItem>
              {BRAZIL_STATES.map((state) => (
                <CommandItem
                  key={state.value}
                  value={state.label} // Usando label para facilitar busca
                  onSelect={() => handleSelect(state.value)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentStateValue === state.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {state.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
