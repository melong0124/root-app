import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";

interface MonthSelectorProps {
    currentDate: Date;
}

export function MonthSelector({ currentDate }: MonthSelectorProps) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const handlePrevMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() - 1);
        updateDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + 1);
        updateDate(newDate);
    };

    const updateDate = (date: Date) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set("year", date.getFullYear().toString());
        newParams.set("month", (date.getMonth() + 1).toString());
        navigate(`?${newParams.toString()}`);
    };

    const formattedDate = new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
    }).format(currentDate);

    return (
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold min-w-[120px] text-center">
                {formattedDate}
            </span>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
