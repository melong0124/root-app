import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";

interface YearSelectorProps {
    currentYear: number;
}

export function YearSelector({ currentYear }: YearSelectorProps) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const handlePrevYear = () => {
        updateYear(currentYear - 1);
    };

    const handleNextYear = () => {
        updateYear(currentYear + 1);
    };

    const updateYear = (year: number) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("year", year.toString());
        // Remove month param if it exists, as we are viewing the whole year
        newParams.delete("month");
        navigate(`?${newParams.toString()}`);
    };

    return (
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePrevYear}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold min-w-[100px] text-center">
                {currentYear}년
            </span>
            <Button variant="ghost" size="icon" onClick={handleNextYear}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
