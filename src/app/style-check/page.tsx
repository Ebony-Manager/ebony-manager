"use client";

// Throwaway verification route — NOT part of the real app nav. Shows every
// piece pulled from Atlas (src/components/ui/) rendered through Ebony's own
// tokens (globals.css), to confirm the shared-pieces contract actually
// resolves to Ebony's identity (wood/gold/warm-white, Inter) and not
// Atlas's (espresso/gold-oklch, Geist). Outside the (app) route group on
// purpose — no auth gate, so it's reachable without a working Google
// Client ID while iterating.

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useForm } from "react-hook-form";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-border pb-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

function DemoForm() {
  const form = useForm({ defaultValues: { nombre: "" } });
  return (
    <Form {...form}>
      <form className="w-64 space-y-4">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Nombre completo" {...field} />
              </FormControl>
              <FormDescription>Solo para probar la pieza — no se guarda nada acá.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

export default function StyleCheckPage() {
  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">/style-check</h1>
          <p className="text-sm text-muted-foreground">
            Piezas de Atlas (src/components/ui/) renderizadas con los tokens de Ebony. Ruta desechable, sin gate de auth.
          </p>
          <p className="text-sm text-muted-foreground">
            Modo oscuro: Ebony no tiene paleta oscura definida todavía (no hay bloque{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">@media (prefers-color-scheme: dark)</code> en
            globals.css) — emular oscuro en el navegador debería verse IGUAL a claro hoy. Eso es lo esperado, no un bug.
          </p>
        </header>

        <Section title="Button — todas las variantes">
          <Button>Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </Section>

        <Section title="Badge — incluye success/warning (tokens nuevos)">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </Section>

        <Section title="Card">
          <Card className="w-72">
            <CardHeader>
              <CardTitle>Proyecto Casa Rivera</CardTitle>
              <CardDescription>Closets + cocina, en taller</CardDescription>
              <CardAction>
                <Badge variant="warning">En Taller</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Cotización total: $4,820.00</p>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="outline">
                Ver detalle
              </Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="Input / Textarea / Label">
          <div className="w-64 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-input">Cliente</Label>
              <Input id="sc-input" placeholder="Nombre del cliente" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-textarea">Notas</Label>
              <Textarea id="sc-textarea" placeholder="Notas del proyecto" />
            </div>
            <Input placeholder="Deshabilitado" disabled />
          </div>
        </Section>

        <Section title="Select">
          <Select defaultValue="closet">
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="closet">Closet</SelectItem>
              <SelectItem value="cocina">Cocina</SelectItem>
              <SelectItem value="revestimiento">Revestimiento</SelectItem>
            </SelectContent>
          </Select>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="activos" className="w-full max-w-md">
            <TabsList>
              <TabsTrigger value="activos">Activos</TabsTrigger>
              <TabsTrigger value="entregados">Entregados</TabsTrigger>
              <TabsTrigger value="cancelados">Cancelados</TabsTrigger>
            </TabsList>
            <TabsContent value="activos" className="pt-3 text-sm text-muted-foreground">
              3 proyectos activos.
            </TabsContent>
            <TabsContent value="entregados" className="pt-3 text-sm text-muted-foreground">
              12 proyectos entregados este año.
            </TabsContent>
            <TabsContent value="cancelados" className="pt-3 text-sm text-muted-foreground">
              Sin cancelaciones.
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Table">
          <div className="w-full rounded-lg border border-border">
            <Table>
              <TableCaption>Cotizaciones recientes</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ítem</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Rivera</TableCell>
                  <TableCell>Closet + Cocina</TableCell>
                  <TableCell>
                    <Badge variant="warning">En Taller</Badge>
                  </TableCell>
                  <TableCell className="text-right">$4,820.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Espino</TableCell>
                  <TableCell>Revestimiento</TableCell>
                  <TableCell>
                    <Badge variant="success">Entregado</Badge>
                  </TableCell>
                  <TableCell className="text-right">$1,210.50</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Section>

        <Section title="Dialog / Sheet / Popover / DropdownMenu / Tooltip">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Abrir Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva cotización</DialogTitle>
                <DialogDescription>Solo para probar la pieza — no crea nada real.</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Contenido de ejemplo.</p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancelar</Button>
                </DialogClose>
                <Button>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Abrir Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Detalle del proyecto</SheetTitle>
                <SheetDescription>Panel lateral de ejemplo.</SheetDescription>
              </SheetHeader>
              <div className="px-4 text-sm text-muted-foreground">Contenido de ejemplo.</div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="secondary">Cerrar</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Abrir Popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p className="text-sm">Contenido de popover de ejemplo.</p>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Abrir Menú</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Editar</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Eliminar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked>Mostrar archivados</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover para tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip de ejemplo</TooltipContent>
          </Tooltip>
        </Section>

        <Section title="Avatar / Progress / Skeleton / Separator">
          <Avatar>
            <AvatarImage src="https://i.pravatar.cc/64?img=12" alt="Avatar" />
            <AvatarFallback>EB</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>TH</AvatarFallback>
          </Avatar>
          <div className="w-48 space-y-2">
            <Progress value={62} />
          </div>
          <div className="w-48 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex h-8 items-center gap-3">
            <span className="text-sm">Izquierda</span>
            <Separator orientation="vertical" />
            <span className="text-sm">Derecha</span>
          </div>
        </Section>

        <Section title="ScrollArea">
          <ScrollArea className="h-32 w-64 rounded-lg border border-border p-3">
            <div className="space-y-2 text-sm text-muted-foreground">
              {Array.from({ length: 12 }).map((_, i) => (
                <p key={i}>Ítem de catálogo #{i + 1}</p>
              ))}
            </div>
          </ScrollArea>
        </Section>

        <Section title="Command">
          <Command className="w-72 rounded-lg border border-border">
            <CommandInput placeholder="Buscar ítem…" />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                <CommandItem>Closet</CommandItem>
                <CommandItem>Cocina</CommandItem>
                <CommandItem>Revestimiento</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </Section>

        <Section title="Form (react-hook-form, demo estático)">
          <DemoForm />
        </Section>
      </div>
    </div>
  );
}
