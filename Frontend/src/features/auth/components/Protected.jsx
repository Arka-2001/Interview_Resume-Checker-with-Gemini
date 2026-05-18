import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router";

export const Protected = ({ children }) => {

    const { user, loading } = useAuth()

    if (loading) {
        return <h1>Loading...</h1>
    }

    if (!user) {
        return <Navigate to="/login" />
    }

    return children

}