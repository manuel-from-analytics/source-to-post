import { User, Key, Globe, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground mt-1">Configura tu perfil y preferencias</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil
          </CardTitle>
          <CardDescription>Tu información personal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input placeholder="Tu nombre" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" disabled placeholder="tu@email.com" className="opacity-60" />
          </div>
          <Button size="sm">Guardar cambios</Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Contraseña
          </CardTitle>
          <CardDescription>Actualiza tu contraseña</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar contraseña</Label>
            <Input type="password" placeholder="Repite la contraseña" />
          </div>
          <Button size="sm" variant="outline">Cambiar contraseña</Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Preferencias de generación
          </CardTitle>
          <CardDescription>
            Valores por defecto para el generador de posts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Idioma preferido</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona idioma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">Inglés</SelectItem>
                <SelectItem value="pt">Portugués</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estilo de escritura por defecto</Label>
            <Input placeholder="Ej: Profesional y directo, como un mentor..." />
          </div>
          <Button size="sm">Guardar preferencias</Button>
        </CardContent>
      </Card>
    </div>
  );
}
