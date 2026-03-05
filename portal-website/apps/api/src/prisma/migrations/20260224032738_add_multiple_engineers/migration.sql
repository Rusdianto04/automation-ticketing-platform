-- CreateTable
CREATE TABLE "_TicketEngineers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_TicketEngineers_AB_unique" ON "_TicketEngineers"("A", "B");

-- CreateIndex
CREATE INDEX "_TicketEngineers_B_index" ON "_TicketEngineers"("B");

-- AddForeignKey
ALTER TABLE "_TicketEngineers" ADD CONSTRAINT "_TicketEngineers_A_fkey" FOREIGN KEY ("A") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TicketEngineers" ADD CONSTRAINT "_TicketEngineers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
