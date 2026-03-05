import { Ticket } from '@/shadcn/types/tickets';
import { useEffect, useState } from 'react';

export function useTicketFilters(tickets: Ticket[] = []) {
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    const saved = localStorage.getItem("all_selectedStatuses");
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(() => {
    const saved = localStorage.getItem("all_selectedAssignees");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("all_selectedStatuses", JSON.stringify(selectedStatuses));
    localStorage.setItem("all_selectedAssignees", JSON.stringify(selectedAssignees));
  }, [selectedStatuses, selectedAssignees]);

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleAssigneeToggle = (assignee: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(assignee) ? prev.filter((a) => a !== assignee) : [...prev, assignee]
    );
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedAssignees([]);
  };

  const filteredTickets = tickets.filter((ticket) => {
    const statusMatch =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(ticket.isComplete ? "closed" : "open");
    const assigneeMatch =
      selectedAssignees.length === 0 ||
      selectedAssignees.includes(ticket.assignedTo?.name || "Unassigned");
    return statusMatch && assigneeMatch;
  });

  return {
    selectedStatuses,
    selectedAssignees,
    handleStatusToggle,
    handleAssigneeToggle,
    clearFilters,
    filteredTickets
  };
}
